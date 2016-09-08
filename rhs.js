const SUBFACTS = ['type', 'note', 'score', 'element'];


function out(key) {
    return new OutwardRhs(key);
}


// A right-hand side is a strung-together series of calls like
// type('smoo').func(blah).type('whee').score(2). They layer together like
// sheets of transparent acetate: if there are repeats, as with type() just
// now, the rightmost takes precedence. Similarly, if func(), which can return
// multiple properties of a fact (element, note, score, and type), is missing
// any of these properties, we will continue searching to the left for anything
// that fills them in (including other func()s). To prevent this, return all
// properties explicitly from your func, even if they are no-ops (like {score:
// 1, note: undefined, type: undefined}).
class InwardRhs {
    constructor () {
        this._calls = [];
        this._max = Infinity;
        this._types = new Set();
    }

    // Declare that the maximum returned score multiplier is such and such.
    // This doesn't force it to be true; it merely throws an error if it isn't.
    // This overrides any previous calls to .max().
    max (score) {
        this._max = score;
    }

    _checkMax(fact) {
        if (fact.score !== undefined && fact.score > this._max) {
            throw new Error(`Score of ${fact.score} exceeds the declared max of ${this._max}.`);
        }
    }

    // Determine any of type, note, score, and element using a callback.
    // This overrides any previous calls to .func().
    func (callback) {
        function assignSubfacts(result, fnode) {
            const subfacts = callback(fnode);
            forEach(
                function fillSubfactIfAbsent(subfact) {
                    if (!result.hasOwnProperty(subfact) && subfacts.hasOwnProperty[subfact]) {
                        results[subfact] = subfacts[subfact];
                    }
                },
                SUBFACTS);
        }
        assignSubfacts.type = true;
        assignSubfacts.note = true;
        assignSubfacts.score = true;
        assignSubfacts.element = true;
        assignSubfacts.kind = 'func';
        this._calls.push(assignSubfacts);
    }

    // This overrides any previous calls to .type().
    // In the future, we might also support providing a callback that receives
    // the fnode and returns a type. We couldn't reason based on these, but the
    // use would be rather to override part of what a previous .func() call
    // provides.
    type (...types) {
        this._types.clear();
        if (types.length === 1) {
            // Actually emit a given type.
            function assignType(result) {
                // We can do this unconditionally, because fact() optimizes me
                // out if a type has already been provided.
                result.type = types[0];
            }
            assignType.type = true;
            assignType.kind = 'type';
            this._calls.push(assignType);
        } else if (types.length > 1) {
            // Constrain us to emit 1 of a set of given types.
            forEach(type => this._types.add(type), types);
        }
    }

    function _checkType(result) {
        if (this._types.size > 0 && !this._types.has(result.type)) {
            throw new Error(`A right-hand side claimed to emit one of the types ${types} but actually emitted ${result.type}.`);
        }
    }

    // Whatever the callback returns (even undefined) becomes the note of the
    // fact.
    // This overrides any previous calls to .note().
    note (callback) {
        function assignNote(result, fnode) {
            // We can do this unconditionally, because fact() optimizes me
            // out if a note has already been provided.
            result.note = callback(fnode);
        }
        assignNote.note = true;
        assignNote.kind = 'note';
        this._calls.push(assignNote);
    }

    // This overrides any previous calls to .score().
    // In the future, we might also support providing a callback that receives
    // the fnode and returns a score. We couldn't reason based on these, but
    // the use would be rather to override part of what a previous .func() call
    // provides.
    score (theScore) {
        function assignScore(result, fnode) {
            // We can do this unconditionally, because fact() optimizes me
            // out if a score has already been provided.
            result.score = theScore;
        }
        assignScore.score = true;
        assignScore.kind = 'score';
        this._calls.push(assignScore);
    }

    // Future: why not have an .element() method for completeness?

    // Run all my func().type().notes().score() stuff across a given fnode,
    // enforce my max() stuff, and return a fact ({element, type, score,
    // notes}) for incorporation into that fnode (or a different one, if
    // element is specified). Any of the 4 fact properties can be missing;
    // filling in defaults is a job for the caller.
    fact (fnode) {
        const doneKinds = new Set();
        for call in this._calls backward:
            // If we've already called a call of this kind, then forget it.
            if (!doneKinds.has(call.kind)) {
                doneKinds.add(call.kind);

                // If this call can't possibly provide a subfact we're missing,
                // forget it.
                forEach(
                    function tryToFillSubfact(subfact) {
                        if (!result.hasOwnProperty(subfact) && call[subfact] === true) {
                            call(result, fnode);
                        }
                    },
                    SUBFACTS);
        // TODO: Have this.maxScore (or maybe rule.maxScore) that can be read from the outside.
        this._checkMax(result);
        this._checkType(result);
        return result;
    }
}

// Illegal: multi-arg type() without a func()
// At runtime: throw if the score comes out > the arg to max().
// Maybe build an array of providers for each datum (notes, element, score, etc.) and run them oldest to newest.


class OutwardRhs {
    constructor (key) {
        this._key = key;
        this.through = x => x;
    }

    through (callback) {
        this.through = callback;
    }
}


module.exports = {
    out
};
