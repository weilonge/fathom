const {InwardRhs} = require('./ruleset');


// Constrain to only the max-scoring node of a type on the LHS.
function max() {
    return Side({method: 'max', args: []});
}


function func(callback) {
    return Side({method: 'func', args: [callback]});
}


// Constrain to an input type on the LHS, or apply a type on the RHS.
function type(theType) {
    return Side({method: 'type', args: [theType]});
}


function note(callback) {
    return Side({method: 'note', args: [callback]});
}


function score(theScore) {
    return Side({method: 'score', args: [theScore]});
}


function scoreUpTo(score) {
    return Side({method: 'scoreUpTo', args: [score]});
}


function typeIn(...types) {
    return Side({method: 'typeIn', args: types});
}


function conserveScore() {
    return Side({method: 'conserveScore', args: []});
}


// A string of calls that can be compiled into a Rhs or Lhs, depending on its
// position in a Rule. This lets us use type() as a leading call for both RHSs
// and LHSs. I would prefer to do this dynamically, but that wouldn't compile
// down to old versions of ES.
class Side {
    constructor (firstCall) {
        // A "call" is like {method: 'dom', args: ['p.smoo']}.
        this.calls = [firstCall];
    }

    max () {
        this._push('max');
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

    scoreUpTo (score) {
        this._push('scoreUpTo', score);
    }

    typeIn (...types) {
        this._push('typeIn', ...types);
    }

    conserveScore () {
        this._push('conserveScore');
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
    conserveScore,
    func,
    max,
    note,
    score,
    scoreUpTo,
    type,
    typeIn
};
