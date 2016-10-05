// The left-hand side of a rule

const {filter, flatten, map, unique} = require('wu');
const {maxes, setDefault} = require('./utils');


// Return a condition that uses a DOM selector to find its matches from the
// original DOM tree.
function dom(selector) {
    return new DomLhs(selector);
}


// Rules and the LHSs and RHSs that comprise them have no mutable state. This
// lets us make BoundRulesets from Rulesets without duplicating the rules. It
// also lets us share a common cache among rules: multiple ones might care
// about a cached type(), for instance; there isn't a one-to-one relationship
// of storing with caring. There would also, because of the interdependencies
// of rules in a ruleset, be little use in segmenting the caches: if you do
// something that causes one to need to be cleared, you'll need to clear many
// more as well.
//
// Lhses are responsible for maintaining ruleset.typeCache and ruleset.maxCache.
//
// Lhs and its subclasses are private to the Fathom framework.
class Lhs {
    // Return a new Lhs of the appropriate kind, given its first call.
    static fromFirstCall(firstCall) {
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
    checkFact(fact) {
    }

    // Return the single type the output of the LHS is guaranteed to have.
    // Return undefined if there is no such single type we can ascertain.
    guaranteedType() {
    }
}


class DomLhs extends Lhs {
    constructor(selector) {
        super();
        if (selector === undefined) {
            throw new Error('A querySelector()-style selector is required as the argument to dom().');
        }
        this.selector = selector;
    }

    fnodes(ruleset) {
        const matches = ruleset.doc.querySelectorAll(this.selector);
        const ret = [];
        for (let i = 0; i < matches.length; i++) {  // matches is a NodeList, which doesn't conform to iterator protocol
            const element = matches[i];
            ret.push(ruleset.fnodeForElement(element));
        }
        return ret;
    }

    checkFact(fact) {
        if (fact.type === undefined) {
            throw new Error(`The right-hand side of a dom() rule failed to specify a type. This means there is no way for its output to be used by later rules. All it specified was ${fact}.`);
        }
    }

    asLhs() {
        return this;
    }
}


// Internal representation of a LHS constrained by type but not by max()
class TypeLhs extends Lhs {
    constructor(type) {
        super();
        if (type === undefined) {
            throw new Error('A type name is required when calling type().');
        }
        this.type = type;
    }

    fnodes(ruleset) {
        return setDefault(
            ruleset.typeCache,
            this.type,
            function allFnodesOfType() {
                // We don't really care if the rule *adds* the given
                // type, just that we find all the fnodes of that type.
                const fnodesMaybeOfType = flatten(true,
                                                  map(rule => rule.results(),
                                                      ruleset.rulesWhichMightAdd(this.type)));
                const fnodesOfType = filter(fnode => fnode.hasType(this.type),
                                            fnodesMaybeOfType);
                return Array.from(unique(fnodesOfType));
            });
    }

    // Override the type previously specified by this constraint.
    type(inputType) {
        // Preserve the class in case this is a TypeMaxLhs.
        return new this.constructor(inputType);
    }

    // Return a new LHS constrained to return only the max-scoring node of
    // a type. If there is a tie, more than 1 node may be selected.
    max() {
        return new TypeMaxLhs(this.type);
    }

    guaranteedType() {
        return this.type;
    }
}


// Internal representation of a LHS that has both type and max([NUMBER])
// constraints. max(NUMBER != 1) support is not yet implemented.
class TypeMaxLhs extends TypeLhs {
    // Return the max-scoring node (or nodes if there is a tie) of the given
    // type.
    fnodes(ruleset) {
        // TODO: Optimize better. Walk the dependency tree, and run only the
        // rules that could possibly lead to a max result. As part of this,
        // make RHSs expose their max potential scores.
        const getSuperFnodes = () => super.fnodes(ruleset);
        return setDefault(
            ruleset.maxCache,
            this.type,
            function maxFnodesOfType() {
                return maxes(getSuperFnodes(), fnode => fnode.getScore(this.type));
            });
    }
}


module.exports = {
    dom,
    Lhs
};
