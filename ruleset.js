const {filter, forEach, map, unique} = require('wu');

const {setDefault} = require('./utils');
const {Lhs} = require('./lhs');
const {InwardRhs} = require('./rhs');


class Ruleset {
    constructor (...rules) {
        // TODO: Shove the rules somewhere.
    }

    against (doc) {
        return new BoundRuleset(doc);
    }
}


// A ruleset that is earmarked to analyze a certain DOM
//
// This also carries with it a cache of rule results.
class BoundRuleset {
    constructor (doc) {
        this.doc = doc;

        // TODO: Assemble a hash of out rules by name in this._outRules.
        // TODO: Stick an Array of rules in this._rules.

        // Private, for the use of only helper classes:
        this.ruleCache = new Map();  // Rule instance => Array of result fnodes or out.through() return values
        this.maxCache = new Map();  // type => Array of max fnode (or fnodes, if tied) of this type
        this.typeCache = new Map();  // type => Array of all fnodes of this type
        this.elementCache = new Map();  // DOM element => fnode about it
    }

    // Return an array of zero or more results.
    // thing: can be...
    //   * A string which matches up with an "out" rule in the ruleset. In this
    //     case, fnodes will be returned. Or, if the out rule referred to uses
    //     through(), whatever the results of through's callback will be
    //     returned.
    //   * (Experimental) An arbitrary LHS which we'll calculate and return the
    //     results of. In this case, fnodes will be returned. (Note: LHSs
    //     passed in like this will be taken as part of the ruleset in future
    //     calls.)
    //   * A DOM node, which will (inefficiently) run the whole ruleset and
    //     return the fully annotated fnode corresponding to that node
    // Results are cached in the first and third cases.
    get (thing) {
        if (typeof thing === 'string') {
            return this._outRules[thing].results(this);
        } else if (thing instanceof Lhs) {
            return Array.from(thing.results(this));
        } else if (thing.hasProperty('nodeName')) {
            // Compute everything (not just things that lead to outs):
            for (let rule of this._rules) {
                if (rule instanceof InwardRule) {
                    rule.results(this);
                }
            }
            return this.fnodeForElement(thing);
            // TODO: How can we be more efficient about this, for classifying
            // pages (in which case the classifying types end up attached to a
            // high-level element like <html>)? Maybe we care only about some
            // of the classification types in this ruleset: let's not run the
            // others.
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

    // Return an iterable of rules which might add a given type to fnodes.
    // We return any rule we can't prove doesn't add the type. None, it
    // follows, are OutwardRules. Also, note that if a rule both takes and
    // emits a certain type, it is not considered to "add" it.
    rulesWhichMightAdd (type) {
        // The work this does is cached in this.typeCache by the Lhs.
        return filter(rule => rule.mightAdd(type), this._rules);
    }

    // Return the Fathom node that describes the given DOM element.
    fnodeForElement (element) {
        return setDefault(this.elementCache,
                          element,
                          () => new Fnode(element));
    }
}


// We place the in/out distinction in Rules because it determines whether the
// RHS result is cached, and Rules are responsible for maintaining the rulewise
// cache ruleset.ruleCache.
class Rule {
    constructor (lhs, rhs) {
        this.lhs = lhs.asLhs();
        this.rhs = rhs.asRhs();
    }
}


// A normal rule, whose results head back into the Fathom knowledgebase, to be
// operated on by further rules.
class InwardRule extends Rule {
    // Return the fnodes emitted by the RHS of this rule.
    results (ruleset) {
        // This caches the fnodes emitted by the RHS result of a rule. Any more
        // fine-grained caching is the responsibility of the delegated-to
        // results() methods. For now, we consider most of what a LHS computes
        // to be cheap, aside from type() and type().max(), which are cached by
        // their specialized LHS subclasses.
        return setDefault(
            ruleset.ruleCache,
            this,
            function computeFnodes() {
                const leftFnodes = this.lhs.fnodes(ruleset);
                // Avoid returning a single fnode more than once. LHSs uniquify
                // themselves, but the RHS can change the element it's talking
                // about and thus end up with dupes.
                const returnedFnodes = new Set();

                // Merge facts into fnodes:
                forEach(
                    function updateFnode(leftFnode) {
                        let fact = this.rhs.fact(leftFnode);
                        lhs.checkFact(fact);
                        const rightFnode = ruleset.fnodeForElement(fact.element || leftFnode.element);
                        this._checkFact(fact, rightFnode);
                        if (fact.score !== undefined) {
                            rightFnode.score *= fact.score;
                        }
                        if (fact.type !== undefined) {
                            rightFnode.setNote(fact.type, fact.note);
                        }
                        returnedNodes.add(rightFnode);
                    },
                    leftFnodes);

                return Array.from(returnedFnodes.values());  // TODO: Use unique().
            });
    }

    // Return false if we can prove I never add the given type to fnodes.
    // Otherwise, return true.
    mightAdd (type) {
        const inputType = this.lhs.guaranteedType();
        const outputTypes = this.rhs.possibleTypes();

        if (type === inputType) {
            // Can't *add* a type that's already on the incoming fnodes
            return false;
        }
        if (outputTypes.size > 0) {
            return outputTypes.has(type);
        }
        return true;
    }

    // Throw an error if something is wrong with a given fact.
    _checkFact (fact, rightFnode) {
        if (fact.type === undefined) {  // No type is given.
            if (fact.note !== undefined) {  // A note is given but no type is given.
                throw new Error(`The right-hand side of a rule specified a note (${fact.note}) without a type.`);
            }
        }
    }
}


// A rule whose RHS is an out(). This represents a final goal of a ruleset.
// Its results go out into the world, not inward back into the Fathom
// knowledgebase.
class OutwardRule extends Rule {
    // Compute the whole thing, including any .through().
    results (ruleset) {
        return setDefault(
            ruleset.ruleCache,
            this,
            () => map(this.rhs.through, this.lhs.fnodes(ruleset)));
    }

    // out() rules never set any types on fnodes.
    mightAdd (type) {
        return false;
    }
}


// Construct and return the proper type of rule class based, for the moment, on
// the inwardness/outwardness of the RHS.
function rule(rhs, lhs) {
}


class Fnode {
    constructor (element, score, types) {
        if (element === undefined) {
            throw new Error("Someone tried to make a fnode without specifying the element they're talking about.");
        }
        this.element = element;
        this.score = score === undefined ? 1 : score;
        this.types = types === undefined ? new Map() : types;
    }

    // Return whether the given type is one of the ones attached to this node.
    hasType (type) {
        return this.types.has(type);
    }

    // Return the note for the given type, undefined if none.
    getNote (type) {
        const scoreAndNote = this.types.get(type);
        if (scoreAndNote !== undefined) {
            return scoreAndNote.note;
        }
    }

    // Return whether this node has a note for the given type.
    // Undefined is not considered a note and may be overwritten with impunity.
    hasNote (type) {
        return this.getNote(type) !== undefined;
    }

    setNote (type, note) {
        if (note !== undefined) {
            if (this.hasNote(type)) {
                throw new Error(`Someone (likely the right-hand side of a rule) tried to add a note of type ${type} to an element, but one of that type already exists. Overwriting notes is not allowed, since it would make the order of rules matter.`);
            } else {
                setDefault(this.types, type, () => {score: 1}).note = note;
            }
        }
    }
}


// A string of calls that can be compiled into a Rhs or Lhs, depending on its
// position in a Rule. This lets us use type() as a leading call for both RHSs
// and LHSs.
class Side {
    constructor (firstCall) {
        // A "call" is like {method: 'dom', args: ['p.smoo']}.
        this.calls = [call];
    }

    max (score) {
        this._push('max', score);
    }

    func (callback) {
        this._push('func', callback);
    }

    type (...types) {
        this._push('type', ...types);
    }

    note (callback) {
        this._push('note', callback);
    }

    score (theScore) {
        this._push('score', theScore);
    }

    _push (method, ...args) {
        this.calls.push({method: method, args: args});
    }

    asLhs () {
        return this._asSide(new Lhs(this.calls[0]), this.calls.slice(1));
    }

    asRhs () {
        return this._asSide(new InwardRhs(), this.calls);
    }

    _asSide (side, calls) {
        for (let call of calls) {
            side = side[call.method](...call.args);
        }
        return side;
    }
}


module.exports = {
    dom,
    rule,
    Ruleset,
    type
};
