class Ruleset {
    constructor (...rules) {
        // Next: what kind of data structures should we shove the rules in to run the executor efficiently?
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

        // Private, for the use of only helper classes:
        this.ruleCache = new Map();  // Rule instance => results (as Array of fnodes)
        this.maxCache = new Map();  // type => max fnode (or fnodes, if tied) of this type (Array)
        this.typeCache = new Map();  // type => all fnodes of this type (Array)

        // TODO: Assemble a hash of out rules by name in this._outRules.
    }

    // Return an array of zero or more fnodes.
    // `thing` can be...
    //   * A string which matches up with an "out" rule in the ruleset
    //   * An arbitrary LHS which we'll calculate and return the results of.
    //     (Note: LHSs passed in like this will be taken as part of the ruleset
    //     in future calls.)
    //   * A DOM node, which will (inefficiently) run the whole ruleset and
    //     return the fully annotated fnode corresponding to that node
    // Results are cached in the first and third cases.
    get (thing) {
        if (typeof thing === 'string') {
            return this._outRules[thing].result(this);
        } else if (thing instanceof Lhs) {
            return thing.result(this);
        } else if (thing.hasProperty('nodeName')) {
            for (let out of this._outRules.values()) {
                out.result(this);
            }
            return this._fnodeForElement(thing);
        } else {
            throw new Error('ruleset.get() expects a string, an expression like on the left-hand side of a rule, or a DOM node.');
        }
    }

    _fnodeForElement (element) {
        return setDefault(this._nodeCache,
                          element,
                          () => new Fnode (element));
    }
}


class Rule {
    constructor (rhs, lhs) {
        this.rhs = rhs;
        this.lhs = lhs;
    }

    // NEXT: Write the inversion-of-control executor here or in Lhs (we call Lhs.result() above).
}


// A rule whose RHS is an out(). This represents a final goal of a ruleset.
class OutRule {
    result (ruleset) {
        
    }
}


// Construct and return the proper type of rule class based, for the moment, on
// the LHS.
function rule(rhs, lhs) {
    if (lhs instanceof TypeMaxLhs) {
        
    }
}


// Return a condition that uses a DOM selector to find its matches from the
// original DOM tree.
function dom(selector) {
    return new Dom(selector);
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
class Lhs {
    // Return the output fnodes selected by this left-hand-side expression.
    // ruleset: a BoundRuleset
    // result (ruleset)
}


class DomLhs extends Lhs {
    constructor (selector) {
        this.selector = selector;
    }

    result (ruleset) {
        
    }
}


// Internal representation of a LHS constrained by type
class TypeLhs extends Lhs {
    constructor (type) {
        if (type === undefined) {
            throw new Error('A type name is required when calling type().');
        }
        this.type = type;
    }

    // Override the type previously specified by this constraint.
    type (inputType) {
        // Preserve the class in case this is a TypeMaxLhs.
        return this.constructor(inputType);
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
}


class Fnode {
    constructor (element, score, types) {
        this.element = element;
        this.score = score === undefined ? 1 : score;
        this.types = types === undefined ? new Map() : types;
    }
}


module.exports = {
    dom,
    rule,
    Ruleset,
    type
};
