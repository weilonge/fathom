import "babel-polyfill";


function zeroScore(node) {
    return 0;
}


function idScore(node) {
    // Do regex stuff and return a score.
}


var rules = [
    ['.ad', zeroScore],
    ['[id]', idScore]
];


// Tag a DOM tree or subtree with scores.
// Maybe this will become the map portion of a map-reduce analog.
function score(tree, rules) {
//    until nothing matches:
        for (let [pattern, predicate] of rules) {
            console.log([pattern, predicate]);
//             matches = tree.querySelectorAll(pattern)
//             for each match in matches:
//                 transform node according to RHS of production
        }
}

score(null, rules);