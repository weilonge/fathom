const {filter, map, unique} = require('wu');
const {setDefault} = require('./utils');


// Return a condition that uses a DOM selector to find its matches from the
// original DOM tree.
function dom(selector) {
    return new DomLhs(selector);
}


// Return a condition that discriminates on fnodes by type.
function type(inputType) {
    return new TypeLhs(inputType);
}


// Rules and the LHSs and RHSs that comprise them have no state. This lets us
// make BoundRulesets from Rulesets without duplicating the rules. It also lets
// us share a common cache among rules: multiple ones might care about a cached
// type(), for instance; there isn't a one-to-one relationship of storing with
// caring. There would also, because of the interdependencies of rules in a
// ruleset, be little use in segmenting the caches: if you do something that
// causes one to need to be cleared, you'll need to clear many more as well.
//
// Lhses are responsible for maintaining ruleset.typeCache and ruleset.maxCache.
class Lhs {
    constructor (firstCall) {
        if (firstCall.method === 'dom') {
            return new DomLhs(...firstCall.args);
        } else if (firstCall.method === 'type') {
            return new TypeLhs(...firstCall.args);
        } else {
            throw new Error('The left-hand side of a rule() must start with dom() or type().');
        }
    }

    // Return the output fnodes selected by this left-hand-side expression.
    // ruleset: a BoundRuleset
    // fnodes (ruleset)

    // Check that a RHS-emitted fact is legal for this kind of LHS, and throw
    // an error if it isn't.
    checkFact (fact) {
    }
}


class DomLhs extends Lhs {
    constructor (selector) {
        if (selector === undefined) {
            throw new Error('A querySelector()-style selector is required as the argument to dom().');
        }
        this.selector = selector;
    }

    fnodes (ruleset) {
        const matches = ruleset.doc.querySelectorAll(this.selector);
        for (let i = 0; i < matches.length; i++) {  // matches is a NodeList, which doesn't conform to iterator protocol
            const element = matches[i];
            yield ruleset.fnodeForElement(element);
        }
    }

    checkFact (fact) {
        if (fact.type === undefined) {
            throw new Error(`The right-hand side of a dom() rule failed to specify a type. This means there is no way for its output to be used by later rules. All it specified was ${fact}.`);
        }
    }
}


// Internal representation of a LHS constrained by type but not by max()
class TypeLhs extends Lhs {
    constructor (type) {
        if (type === undefined) {
            throw new Error('A type name is required when calling type().');
        }
        this.type = type;
    }

    fnodes (ruleset) {
        return setDefault(
            ruleset.typeCache,
            this.type,
            function allFnodesOfType () {
                // We don't really care if the rule *adds* the given
                // type, just that we find all the fnodes of that type.
                const fnodesMaybeOfType = flatten(true,
                                                  map(rule => rule.results(),
                                                      ruleset.rulesWhichMightAdd(this.type)));
                const fnodesOfType = filter(fnode => fnode.typesAndNotes.has(this.type),
                                            fnodesMaybeOfType);
                return Array.from(unique(fnodesOfType));
            });
    }

    // Override the type previously specified by this constraint.
    type (inputType) {
        // Preserve the class in case this is a TypeMaxLhs.
        return new this.constructor(inputType);
    }

    // Return a new LHS constrained to return only the max-scoring node of
    // a type. If there is a tie, more than 1 node may be selected.
    max () {
        return new TypeMaxLhs(this.type);
    }
}


// Internal representation of a LHS that has both type and max([NUMBER])
// constraints. max(NUMBER != 1) support is not yet implemented.
class TypeMaxLhs extends TypeLhs {
    fnodes (ruleset) {
        // Given the max score encountered so far and a set of fnodes
        // encountered so far with that score, look at an iterable of
        // additional fnodes, and return the new values of maxActualScore and
        // maxFnodes, maintaining their invariants.
        function addMaxes(maxActualScore, maxFnodes, newFnodes) {
            for (let newFnode of newFnodes) {
                if (newFnode.score > maxActualScore) {
                    maxFnodes.clear();
                    maxFnodes.add(newFnode);
                    maxActualScore = newFnode.score;  // TODO: correct scope?
                } else if (newFnode.score === maxActualScore) {
                    maxFnodes.add(newFnode);
                }
            }
            return maxActualScore;
        }

        return setDefault(
            ruleset.maxCache,
            this.type,
            function maxFnodesOfType () {
                // Future optimization: we could use ruleset.typeCache iff it
                // is filled out.
                const rules = Array.from(ruleset.rulesWhichMightAdd(this.type));
                let maxFnodes = new Set();
                let maxActualScore = 0;  // the highest score actually found so far

                // Sort with highest potential scores first:
                rules.sort((a, b) => a.maxScore - b.maxScore);

                // Run each rule, updating the max-so-far accumulators as we
                // go, until we get to rules that can't possibly beat our
                // current maxes:
                for (let rule of rules) {
                    if (rule.maxScore >= maxActualScore) {
                        const resultsOfCorrectType = filter(fnode => fnode.typesAndNotes.has(this.type),
                                                            rule.results());
                        maxActualScore = addMaxes(maxActualScore,
                                                  maxFnodes,
                                                  resultsOfCorrectType);
                    } else {
                        break;
                    }
                }
                return Array.from(maxFnodes.values());
            });
}


module.exports = {
    dom,
    type,
    Lhs,
    DomLhs,
    TypeLhs,
    TypeMaxLhs 
};
