const {filter, forEach, map} = require('wu');

const {Fnode} = require('./fnode');
const {setDefault} = require('./utils');
const {out, OutwardRhs} = require('./rhs');


// Construct and return the proper type of rule class based on the
// inwardness/outwardness of the RHS.
function rule(lhs, rhs) {
    // Since out() is a valid call only on the RHS (unlike type()), we can take
    // a shortcut here: any outward RHS will already be an OutwardRhs; we don't
    // need to sidetrack it through being a Side. And OutwardRhs has an asRhs()
    // that just returns itself.
    return new ((rhs instanceof OutwardRhs) ? OutwardRule : InwardRule)(lhs, rhs);
}


// Sugar for conciseness and consistency
function ruleset(...rules) {
    return new Ruleset(...rules);
}


// An unbound ruleset. Eventually, you'll be able to add rules to these. Then,
// when you bind them by calling against(), the resulting BoundRuleset will be
// immutable.
class Ruleset {
    constructor(...rules) {
        this._inRules = [];
        this._outRules = new Map();
        this._rulesThatCouldEmit = new Map();  // type -> [rules]
        this._rulesThatCouldAdd = new Map();  // type -> [rules]

        // Separate rules into out ones and in ones, and sock them away. We do
        // this here so mistakes raise errors early.
        for (let rule of rules) {
            if (rule instanceof InwardRule) {
                this._inRules.push(rule);

                // Keep track of what inward rules can emit or add:
                // TODO: Combine these hashes for space efficiency:
                const emittedTypes = rule.typesItCouldEmit();
                if (emittedTypes.size === 0) {
                    throw new Error('A rule did not declare the types it can emit using type() or typeIn().');
                }
                for (let type of emittedTypes) {
                    setDefault(this._rulesThatCouldEmit, type, () => []).push(rule);
                }
                for (let type of rule.typesItCouldAdd()) {
                    setDefault(this._rulesThatCouldAdd, type, () => []).push(rule);
                }
            } else if (rule instanceof OutwardRule) {
                this._outRules.set(rule.key(), rule);
            } else {
                throw new Error(`This input to ruleset() wasn't a rule: ${rule}`);
            }
        }
    }

    against(doc) {
        return new BoundRuleset(doc,
                                this._inRules,
                                this._outRules,
                                this._rulesThatCouldEmit,
                                this._rulesThatCouldAdd);
    }
}


// A ruleset that is earmarked to analyze a certain DOM
//
// This also carries with it a cache of rule results.
class BoundRuleset {
    // inRules: an Array of non-out() rules
    // outRules: a Map of output keys to out() rules
    constructor(doc, inRules, outRules, rulesThatCouldEmit, rulesThatCouldAdd) {
        this.doc = doc;
        this._inRules = inRules;
        this._outRules = outRules;
        this._rulesThatCouldEmit = rulesThatCouldEmit;
        this._rulesThatCouldAdd = rulesThatCouldAdd;

        // Private, for the use of only helper classes:
        this.ruleCache = new Map();  // Rule instance => Array of result fnodes or out.through() return values
        this.maxCache = new Map();  // type => Array of max fnode (or fnodes, if tied) of this type
        this.typeCache = new Map();  // type => Set of all fnodes of this type found so far. (The dependency resolution during execution ensures that individual types will be comprehensive just in time.)
        this.elementCache = new Map();  // DOM element => fnode about it
    }

    // Return an array of zero or more results.
    // thing: can be...
    //   * A string which matches up with an "out" rule in the ruleset. In this
    //     case, fnodes will be returned. Or, if the out rule referred to uses
    //     through(), whatever the results of through's callback will be
    //     returned.
    //   * An arbitrary LHS which we'll calculate and return the results of. In
    //     this case, fnodes will be returned.
    //   * A DOM node, which will (compute-intensely) run the whole ruleset and
    //     return the fully annotated fnode corresponding to that node
    // Results are cached in the first and third cases.
    get(thing) {
        if (typeof thing === 'string') {
            if (this._outRules.has(thing)) {
                return Array.from(this._outRules.get(thing).results(this));
            } else {
                throw new Error(`There is no out() rule with key "${thing}".`);
            }
        } else if (thing.nodeName !== undefined) {
            // Compute everything (not just things that lead to outs):
            forEach(rule => this._execute(rule), this._inRules);
            return this.fnodeForElement(thing);
            // TODO: How can we be more efficient about this, for classifying
            // pages (in which case the classifying types end up attached to a
            // high-level element like <html>)? Maybe we care only about some
            // of the classification types in this ruleset: let's not run the
            // others. We could provide a predefined partial RHS that specifies
            // element(root) and a convenience routine that runs .get(each
            // classification type) and then returns the root fnode, which you
            // can examine to see what types are on it.
        } else if (thing.asLhs) {
            // TODO: I'm not sure if we can still do this in Toposort Land. What if they ask for type(b) → score(2)? It won't run other b → b rules. We could just mention that as a weird corner case and tell ppl not to do that. Or we could implement a special case that makes sure we light up all b → b rules whenever we light up one.
            // Make a temporary out rule, and run it. This may add things to
            // the ruleset's cache, but that's fine: it doesn't change any
            // future results; it just might make them faster. For example, if
            // you ask for .get(type('smoo')) twice, the second time will be a
            // cache hit.
            const outRule = rule(thing, out(Symbol('outKey')));
            return Array.from(outRule.results(this));
            // TODO: Don't cache the results of the temporary OutwardRule,
            // since we can never fetch them again, since the OutwardRule
            // itself is the cache key.
        } else {
            throw new Error('ruleset.get() expects a string, an expression like on the left-hand side of a rule, or a DOM node.');
        }
    }

    // Provide an opaque context object to be made available to all ranker
    // functions.
    // context (object) {
    //     self.context = object;
    // }

    // -------- Methods below this point are private to the framework. --------

    // Return all the (shallow) thus-far-unexecuted rules that will have to run
    // to run the requested rule, in the form of
    // Map(prereq: [rulesItIsNeededBy]).
    _prerequisitesTo(rule, undonePrereqs = new Map()) {
        for (let prereq of rule.prerequisites(this)) {
            if (!this.ruleCache.has(prereq)) {
                // prereq is not already run. (If it were, we wouldn't care
                // about adding it to the graph.)
                const alreadyAdded = undonePrereqs.has(prereq);
                setDefault(undonePrereqs, prereq, () => []).push(rule);
                if (!alreadyAdded) {
                    // If prereq has not already had its dependencies added to
                    // the graph, then go add them:
                    this._prerequisitesTo(prereq, undonePrereqs);
                }
            }
        }
        return undonePrereqs;
    }

    // Run the given rule (and its dependencies, in the proper order), and
    // return its result.
    //
    // The basic idea is to sort rules in topographic order (according to input
    // and output types) and then run them. On top of that, we do some
    // optimizations. We keep a cache of results by type (whether partial or
    // comprehensive--either way, the topography ensures that any
    // non-comprehensive typeCache entry is made comprehensive before another
    // rule needs it). And we prune our search for prerequisite rules at the
    // first encountered already-executed rule.
    _execute(rule) {
        if (this.ruleCache.has(rule)) {
            return this.ruleCache.get(type);
        }
        const prereqs = this._prerequisitesTo(rule);
        const sorted = [rule].push(...toposort(prereqs));
        for (rule of reversed(sorted)) {
            for (fnode of rule.fnodes(this)) {
                // Stick the fnode in typeCache under all applicable types.
                // Optimization: we really only need to loop over the types
                // this rule can possibly emit.
                for (type of fnode.typesSoFar()) {
                    setDefault(this.typeCache, type, () => new Set()).add(fnode);
                }
            }
        }
        return fnodes;
    }

    // Return an Array of rules.
    inwardRulesThatCouldEmit(type) {
        return this._rulesThatCouldEmit.get(type);
    }

    // Return an Array of rules.
    inwardRulesThatCouldAdd(type) {
        return this._rulesThatCouldAdd.get(type);
    }

    // Return an iterable of rules which might emit fnodes of a certain type
    // back into the system, either by adding the type or by simply modifying
    // fnodes that have that type already. We return any rule we can't prove
    // doesn't emit the type. None are OutwardRules, since they can't modify
    // anything.
    rulesWhichMightChangeTypedInfo(type) {
        // The work this does is cached in this.typeCache by the Lhs.
        return filter(rule => rule.mightChangeTypedInfo(type), this._inRules);
    }

    // Return the Fathom node that describes the given DOM element.
    fnodeForElement(element) {
        return setDefault(this.elementCache,
                          element,
                          () => new Fnode(element));
    }
}


// We place the in/out distinction in Rules because it determines whether the
// RHS result is cached, and Rules are responsible for maintaining the rulewise
// cache ruleset.ruleCache.
class Rule {  // abstract
    constructor(lhs, rhs) {
        this.lhs = lhs.asLhs();
        this.rhs = rhs.asRhs();
    }

    // Return an Array of the rules that this one depends on in the given
    // ruleset. This may include rules that have already been executed in a
    // BoundRuleset.
    prerequisites(ruleset) {
        // Some LHSs know enough to determine their own prereqs:
        const delegated = this.lhs.prerequisites(ruleset);
        if (delegated !== undefined) {
            return delegated;
        }

        // Otherwise, fall back to a more expensive approach that takes into
        // account both LHS and RHS types:
        const possibleEmissions = this.typesItCouldEmit();
        if (possibleEmissions.size === 1 && possibleEmissions.has(this.lhs.type)) {
            // All this could emit is its input type. It's an A -> A rule.
            return ruleset.inwardRulesThatCouldAdd(this.lhs.type);
        } else {
            return ruleset.inwardRulesThatCouldEmit(this.lhs.type);
        }
    }

    // Return a Set of types.
    typesItCouldEmit() {
        const rhsDeclarations = this.rhs.typesItCouldEmit();
        if (rhsDeclarations.size === 0 && this.lhs.type !== undefined) {
            // It's a b -> b rule.
            return new Set([this.lhs.type]);
        } else {
            return rhsDeclarations;
        }
    }

    // Return a Set of types.
    typesItCouldAdd() {
        const ret = new Set(this.typesItCouldEmit());
        ret.delete(this.lhs.type);
        return ret;
    }
}


// A normal rule, whose results head back into the Fathom knowledgebase, to be
// operated on by further rules.
class InwardRule extends Rule {
    // TODO: On construct, complain about useless rules, like a dom() rule that
    // doesn't assign a type.

    // Return the fnodes emitted by the RHS of this rule.
    results(ruleset) {
        const self = this;
        // This caches the fnodes emitted by the RHS result of a rule. Any more
        // fine-grained caching is the responsibility of the delegated-to
        // results() methods. For now, we consider most of what a LHS computes
        // to be cheap, aside from type() and type().max(), which are cached by
        // their specialized LHS subclasses.
        return setDefault(
            ruleset.ruleCache,
            this,
            function computeFnodes() {
                const leftFnodes = self.lhs.fnodes(ruleset);
                // Avoid returning a single fnode more than once. LHSs uniquify
                // themselves, but the RHS can change the element it's talking
                // about and thus end up with dupes.
                const returnedFnodes = new Set();

                // Merge facts into fnodes:
                forEach(
                    function updateFnode(leftFnode) {
                        const fact = self.rhs.fact(leftFnode);
                        self.lhs.checkFact(fact);
                        const rightFnode = ruleset.fnodeForElement(fact.element || leftFnode.element);
                        // If the RHS doesn't specify a type, default to the
                        // type of the LHS, if any:
                        const rightType = fact.type || self.lhs.guaranteedType();
                        if (fact.conserveScore) {
                            // If conserving, multiply in the input-type score
                            // from the LHS node. (Never fall back to
                            // multiplying in the RHS-type score from the LHS:
                            // it's not guaranteed to be there, and even if it
                            // will ever be, the executor doesn't guarantee it
                            // has been filled in yet.)
                            const leftType = self.lhs.guaranteedType();
                            if (leftType !== undefined) {
                                rightFnode.conserveScoreFrom(leftFnode, leftType, rightType);
                            } else {
                                throw new Error('conserveScore() was called in a rule whose left-hand side is a dom() selector and thus has no predictable type.');
                            }
                        }
                        if (fact.score !== undefined) {
                            if (rightType !== undefined) {
                                rightFnode.multiplyScore(rightType, fact.score);
                            } else {
                                throw new Error(`The right-hand side of a rule specified a score (${fact.score}) with neither an explicit type nor one we could infer from the left-hand side.`);
                            }
                        }
                        if (fact.type !== undefined || fact.note !== undefined) {
                            // There's a reason to call setNote.
                            if (rightType === undefined) {
                                throw new Error(`The right-hand side of a rule specified a note (${fact.note}) with neither an explicit type nor one we could infer from the left-hand side. Notes are per-type, per-node, so that's a problem.`);
                            } else {
                                rightFnode.setNote(rightType, fact.note);
                            }
                        }
                        returnedFnodes.add(rightFnode);
                    },
                    leftFnodes);

                return Array.from(returnedFnodes.values());  // TODO: Use unique().
            });
    }

    // Return false if we can prove I never change typed info (scores, type
    // assignments themselves, notes) of the given type. Otherwise, return true.
    //
    // All RHSs that emit a type (and aren't no-ops) can change that typed info.
    mightChangeTypedInfo(type) {
        const outputTypes = this.rhs.possibleTypes();
        if (outputTypes.size > 0) {
            return outputTypes.has(type);
        }
        return true;
    }
}


// A rule whose RHS is an out(). This represents a final goal of a ruleset.
// Its results go out into the world, not inward back into the Fathom
// knowledgebase.
class OutwardRule extends Rule {
    // Compute the whole thing, including any .through().
    results(ruleset) {
        return setDefault(
            ruleset.ruleCache,
            this,
            () => map(this.rhs.callback, this.lhs.fnodes(ruleset)));
    }

    // Return the key under which the output of this rule will be available.
    key() {
        return this.rhs.key;
    }
}


module.exports = {
    rule,
    ruleset
};
