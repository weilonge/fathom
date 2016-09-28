const {getDefault, setDefault} = require('./utils');


class Fnode {
    constructor (element) {
        if (element === undefined) {
            throw new Error("Someone tried to make a fnode without specifying the element they're talking about.");
        }
        this.element = element;

        // A map of type => {score: number, note: anything}. `score` is always
        // present and defaults to 1. A note is set iff `note` is present and
        // not undefined.
        this._types = new Map();

        // By default, an fnode has an independent score for each of its types.
        // However, a RHS can opt to conserve the score of an upstream type,
        // carrying it forward into another type. To avoid runaway scores in
        // the case that multiple rules choose to do this, we limit the
        // contribution of an upstream type's score to being multiplied in a
        // single time. In this set, we keep track of which upstream types'
        // scores have already been multiplied into each type. LHS fnode => Set
        // of types whose score for that node have been multiplied into this
        // node's score.
        // upstream types whose scores already contributed:
        this._conservedScores = new Map();
    }

    // Return whether the given type is one of the ones attached to this node.
    hasType (type) {
        return this._types.has(type);
    }

    // Return our score for the given type, 1 by default.
    getScore (type) {
        return _typeRecordForGetting(type).score;
    }

    // Return the note for the given type, undefined if none.
    getNote (type) {
        return _typeRecordForGetting(type).note;
    }

    // Return whether this node has a note for the given type.
    // Undefined is not considered a note and may be overwritten with impunity.
    hasNote (type) {
        return this.getNote(type) !== undefined;
    }

    // -------- Methods below this point are private to the framework. --------

    // Multiply one of our per-type scores by a given number. Implicitly assign
    // us the given type.
    multiplyScore (type, score) {
        this._typeRecordForSetting(type).score *= score;
    }

    // Indicate that I should inherit some score from a LHS-emitted fnode. I
    // keep track of (LHS fnode, type) pairs whose scores have already been
    // inherited so we don't multiply them in more than once.
    conserveScoreFrom (lhsFnode, type) {
        if (!(const set = setDefault(this._conservedScores, lhsFnode, () => new Set())).has(type)) {
            set.add(type);
            this.multiplyScore(type, lhsFnode.getScore(type));
        }
    }

    // Set the note attached to one of our types. Implicitly assign us that
    // type if we don't have it already.
    setNote (type, note) {
        if (note !== undefined) {
            if (this.hasNote(type)) {
                throw new Error(`Someone (likely the right-hand side of a rule) tried to add a note of type ${type} to an element, but one of that type already exists. Overwriting notes is not allowed, since it would make the order of rules matter.`);
            } else {
                this._typeRecordForSetting(type).note = note;
            }
        }
    }

    // Return a score/note record for a type, creating it if it doesn't exist.
    _typeRecordForSetting (type) {
        return setDefault(this._types, type, () => {score: 1})
    }

    // Manifest a temporary type record for reading, working around the lack of
    // a .? operator in JS.
    _typeRecordForGetting (type) {
        return getDefault(this._types, type, () => {score: 1});
    }
}


module.exports = {
    Fnode
};
