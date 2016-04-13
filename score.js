import "babel-polyfill";
import {flatMap, forEach, map, sum} from 'lodash';
var jsdom = require("jsdom");


// Wrap a DOM element to provide a handier API for scoring and tagging.
// If we end up not doing our work directly to the DOM tree in the future, this
// saves us rewriting all our transformers.
// function node(element) {
//     return {
//         __proto__: element,
//         rate
// }


// Iterate over a DOM tree or subtree, computing scores for interesting nodes
// and adding them to my knowledgebase.
//
// This is the "rank" portion of the rank-and-yank algorithm.
function score(tree, rules) {
    var kb = knowledgebase();
    var newFacts;

    // Merge adjacent text nodes so inlineTexts() and similar rankers can be
    // simple.
    tree.normalize();

    // We start with an empty KB, so we'd better bootstrap it by running the
    // rules which use the DOM as a source:
    //forEach(rules.ofKind('dom'), dirtyRules.add);

    forEach(rules.ofKind('dom'),
            rule => forEach(resultsOf(rule), result => kb.add));

    // Introduce the whole DOM into the KB as type 'dom' to get things started:
    newFacts = [{type: 'dom', score: 1, tree: tree};];

    // While there are new facts, run the applicable rules over them to
    // generate even newer facts. Repeat until everything's fully digested.
    // Rules run in no particular guaranteed order.
    while (let fact = newFacts.pop()) {
        for (let rule of rules.taking(fact.type)) {
            results = Array.from(resultsOf(rule, fact));
            newFacts.push(...results);
            forEach(results, kb.add);
        }
    }

    return kb;
}

while there are things in nonterminalFacts {
    [inNode, inType] = nonterminalFacts.pop();  // A fact is a node + a type.
    // TODO: We could get an efficiency boost by knowing ahead of time what types a rule can emit and not running those rules on nodes already tagged with that type. We can thus also avoid re-running rules against that new-newly-tagged node redundantly.
    // Actually, we want rules to be able to added which mess with the score. Those are refining rules, and we anticipate refinements.
    for each rule that takes inType:
        facts = runThatRule(inNode and inType perhaps packaged together)
        for fact in facts:
            outNode = kb.nodeForElement(fact.element || inNode)  // makes it if necessary
            multiply outNode.score by score  // No matter whether we're emitting redundant types or not. We want to be able to add rules that refine our understanding of certain nodes and adjust the score, without having to rewire the path of types that makes up the ruleset.
            if fact.type not already in outNode.types:  // An efficiency boost: don't re-annotate a node with a type it already has. That would add new facts and lead to re-running dependent rules redundantly against them. (We shouldn't anticipate rules wanting to take in scribbles of a certain type and mess with them in place, without changing the type. That way is order dependence, by definition. Emit a new type if you want to do that.)
                outNode.types.set(fact.type, fact.scribbles)
                kb.indexNodeByType(outNode, fact.type)  // TODO: better encapsulation rather than indexing explicitly
                nonterminalFacts.push([outNode, fact.type])

}


// Get a key of a map, first setting it to a default value if it's missing.
function getDefault(map, key, defaultMaker) {
    var value = map.get(key);
    var defaultValue;

    if (value === undefined) {
        defaultValue = defaultMaker();
        map.set(key, defaultValue);
        return defaultValue;
    }
    return value;
}


// Construct a collection of rules that we can query on the type of
// node they operate on.
function ruleset(...rules) {
    var rulesByInputType = new Map();  // [someInputType: rule, ...]

    // File each rule under its kind:
    for (let rule of rules) {
        rulesByInputType.set(rule.source.inputType, rule);
    }

    return {
        // Return a collection of rules which take facts of any of the given
        // types as input.
        taking: function (type) {
            return rulesByInputType.get(type);
        }
    };
}


// Construct a container for storing and querying facts, where a fact has a
// type (used to dispatch further rules upon) and a result (arbitrary at the
// moment, generally containing a score).
function knowledgebase() {
    var nodesByType = new Map();  // Map{'texty' -> [NodeA],
                                  //     'spiffy' -> [NodeA, NodeB]}
                                  // NodeA = {element: <someElement>,
                                  //          score: 8,  // global score. Add custom ones with scribbles if you want.
                                  //
                                  //          // Types is a map of type names to scribbles:
                                  //          types: Map{'texty' -> {ownText: 'blah',
                                  //                                 someOtherScribble: 'foo',
                                  //                                 someCustomScore: 10},
                                  //                     'fluffy' -> {}}}
    var nodesByElement = new Map();

    return {
        // Return the "node" (our own data structure that we control) that
        // corresponds to a given DOM element, creating one if necessary.
        nodeForElement: function (element) {
            getDefault(nodesByElement,
                       element,
                       () => {element: element,
                              score: 1,
                              types: new Map()});
        },

        // Let the KB know that a new type has been added to an element.
        indexNodeByType: function (node, type) {
            getDefault(nodesByType, type, () => []).push(node);
        }
    };
}


// A ranker returns 0 or more facts, each of which comprises a score multiplier and, optionally, an element (defaulting to the input one) and type (defaulting to none) and, even more optionally, scribbles (which must be {} if you don't want any). This enables a ranker to walk around the tree and say things about other nodes than the input one.
function someRanker(node) {
    return [{scoreMultiplier: 3,
             element: node.element,
             type: 'texty',
             scribbles: {}}]
}


// Apply a rule (as returned by a call to rule()) to a fact, and return the
// new fact that results.
function resultsOf(rule, fact) {
    // If more types of rule pop up someday, do fancier dispatching here.
    return rule.kind === 'typed' ? resultsOfTypedRule(rule, fact) : resultsOfDomRule(rule, fact);
}


// Pull the DOM tree off the special property of the root "dom" fact, and query
// against it.
function *resultsOfDomRule(rule, fact) {
    var matches = fact.tree.querySelectorAll(pattern);
    var newFact;

    for (let element of matches) {
        newFact = rule.ranker(node(element), fact);  // NEXT: Figure out what rankers return: just int scores or objs full of type info like paragraphish(). I kinda do want them to be able to (1) scribble arbitrary stuff somewhere, (2) return >1 typed fact, (3) be short. Maybe I just have one NodeProxy (at most) for each DOM node, and it contains a ref to the DOM node and a Map of type -> scores-and-scribbles. What to pass to the rankers? At most, the whole NodeProxy. At least, an object which lets them add their typed scribbles to the map. It should go without saying that, once laid down, a typed scribble is immutable.
        // A NodeProxy has element, map of type -> scores and scribbles. Return [{score:int, type:blah}, {...}, ...] from ranker.
        // Actually, 1 score is plenty. That simplifies our data, our rankers, our type system (since we don't need to represent score axes), and our engine. If somebody wants more score axes, they can fake it themselves with scribbles, thus paying only for what they eat. (We can even provide functions that help with that.) Most rulesets will probably be concerned with scoring only 1 thing at a time anyway. So, rankers return a score multiplier + 0 or more new categories with optional scribbles. Facts can never be deleted from the KB by rankers (or order would start to matter); after all, they're *facts*.


        ////meh Return int to just insert {score: int}. Return an obj to insert the obj.
        newFact.element = element;
        // We preserve any other scribbles the ranker made on its result.
        // Other rules or yankers may well want to read them.
        yield newFact;
    }
}

// change vocab from "scribbles" to "notes": shorter and more accurate


// Iterate, depth first, over a DOM node.
// shouldTraverse - a function on a node saying whether we should include it
//     and its children
function *walk(node, shouldTraverse) {
    if (shouldTraverse(node)) {
        yield node;
        for (let child of node.childNodes) {
            for (let w of walk(child, shouldTraverse)) {
                yield w;
            }
        }
    }
}


// Yield strings of text nodes within a normalized DOM node and its children,
// without venturing into any contained block elements.
function *inlineTexts(node) {
    for (let child of walk(node, node => !(isBlock(node) ||
                                           node.tagName === 'script' &&
                                           node.tagName === 'style'))) {
        if (child.nodeType === child.TEXT_NODE) {
            // .wholeText is what needs the DOM tree to be normalized.
            // Otherwise, it'll return the contents of adjacent text nodes,
            // too, and we'll get those contents a second time when we traverse
            // to them.
            yield child.wholeText;
        }
    }
}


function collapseWhitespace(str) {
    return str.replace(/\s{2,}/g, " ");
}


// Return a fact that scores a DOM node based on how much it resembles a
// maximally tight block element full of text.
function paragraphish(node) {
    return {
        type: 'paragraphish',
        score: sum(map(inlineTexts(node),
                       str => collapseWhitespace.length))
    }
}


function main() {
    var doc = jsdom.jsdom(
        '<p><a class="ad" href="https://github.com/tmpvar/jsdom">jsdom!</a></p>'
    );
    var rules = ruleset(
        // Score by length of directly contained text:
        rule(dom('p,div'), paragraphish),

        // Give bonus for being in a semantically appropriate tag:
        rule(typed('paragraphish'), node => node.el.tagName == 'p' ? 1.5 : 1)
    );
    console.log(score(doc, rules));
}


main();


// Return a condition that uses a DOM selector to find its matches from the
// original DOM tree.
//
// For consistency, Nodes will still be delivered to the transformers, but they'll have empty types and score = 1. If the ranker returns null, bail out and don't add the node to any indices.
function dom(selector) {
    return {
        kind: 'dom',
        selector: selector
    }
}


// Return a condition that discriminates on nodes of the knowledgebase by type.
function typed(inputType) {
    return {
        kind: 'typed',
        inputType: inputType
    }
}


function rule(source, ranker) {
    return {
        source: source,
        ranker: ranker
    };
}


// NEXT: This set of rules might be the beginning of something that works. (It's modeled after what I do when I try to do this by hand: I look for balls of black text, and I look for them to be near each other, generally siblings: a "cluster" of them.) Order of rules matters (until we find a reason to add more complexity). (We can always help people insert new rules in the desired order by providing a way to insert them before or after such-and-such a named rule.) And it turned out we didn't use the types much, so maybe we should get rid of those or at least factor them out.
// score on text length -> texty. We start with this because, no matter the other markup details, the main body text is definitely going to have a bunch of text. Every node starts with a score of 1, so we can just multiply all the time.
rule(dom('p,div'), node => ['texty', len(node.mergedStrippedInnerTextNakedOrInInlineTags)] if > 0 else null)  // maybe log or sqrt(char_count) or something. Char count might work even for CJK. mergedInnerTextNakedOrInInInlineTags() doesn't count chars in, say, p (or any other block-level) tags within a div tag.
rule(typed('texty'), node.linkDensity)
// give bonuses for being in p tags. TODO: article tags, too
rule(typed('texty'), node => node.el.tagName === 'p' ? 1.5 : 1)
// give bonuses for being (nth) cousins of other texties  // IOW, texties that are the same-leveled children of a common ancestor get a bonus.
rule(typed('texty'), node => node.numCousinsOfAtLeastOfScore(200) * 1.5)
// Find the texty with the highest score.

// Let rules return multiple knowledgebase entries (even of multiple types), in case we need to label or score a node on 2 orthogonal axes.

// A fancier selector design, with combinators:
rule(and(tag('p'), klass('snork')), scored('texty', node => node.word_count))  // and, tag, and klass are object constructors that the query engine can read. They don't actually do the query themselves. That way, a query planner can be smarter than them, figuring out which indices to use based on all of them. (We'll probably keep a heap by each dimension's score and a hash by type name, for starters.)

// We don't need to know up front what types may be emitted; we can just observe which indices were touched and re-run the rules that take those types in, then the rules that take *those* emitted types in, etc.
// How do we ensure blockquotes, h2s, uls, etc. that are part of the article are included? Maybe what we're really looking for is a single, high-scoring container (or span of a container?) and then taking either everything inside it or everything but certain excised bits (interstitial ads/relateds). There might be 2 phases: rank and yank.
// Also do something about invisible nodes.

Future possible fanciness:
* Metarules, e.g. specific rules for YouTube if it's extremely weird. Maybe they can just take simple predicates over the DOM: metarule(dom => !isEmpty(dom.querySelectorAll('body[youtube]')), rule(...)). Maybe they'll have to be worse: the result of a full rank-and-yank process themselves. Or maybe we can somehow implement them without having to have a special "meta" kind of rule at all.
* Different kinds of "mixing" than just multiplication, though this makes us care even more that rules execute in order and in series. An alternative may be to have rankers lay down the component numbers and a yanker do the fancier math.
* Fancy combinators for rule sources, along with something like a Rete tree for more efficiently dispatching them
* If a ranker returns 0 (i.e. this thing has no chance of being in the category that I'm thinking about), delete the fact from the KB: a performance optimization.
* I'm not sure about constraining us to execute the rules in order. It hurts efficiency and is going to lead us into a monkeypatching nightmare as third parties contribute rules. What if we instead used subtypes to order where necessary, where a subtype is "(explicit-type, rule that touched me, rule that touched me next, ...)". A second approach: Ordinarily, if we were trying to order rules, we'd have them operate on different types, each rule spitting out a fact of a new type and the next rule taking it as input. Inserting a third-party rule into a ruleset like that would require rewriting the whole thing to interpose a new type. But what if we instead did something like declaring dependencies on certain rules but without mentioning them (in case the set of rules in the ruleset changes later). This draws a clear line between the ruleset's private implementation and its public, hookable API. Think: why would 3rd-party rule B want to fire between A and C? Because it requires some data A lays down and wants to muck with it before C uses it as input. That data would be part of facts of a certain type (if the ruleset designer is competent), and rules that want to hook in could specify where in terms of "I want to fire right after facts of type FOO are made." They can then mess with the fact before C sees it.
* We could even defer actually multiplying the ranks together, preserving the individual factors, in case we can get any interesting results out of comparing the results with and without certain rules' effects.
* Probably fact types and the score axes should be separate: fact types state what kind of scribblings are available about nodes (and might affect rule order if they want to use each other's scribblings). Score axes talk about the degree to which a node is in a category. Each fact would be linked to a proxy for a DOM node, and all scores would live on those proxies.

Yankers:
max score (on some dimension)
max-scored sibling cluster (maybe a contiguous span of containers around high-scoring ones, like a blur algo allowing occasional flecks of low-scoring noise)
adjacent max-scored sibling clusters (like for Readability's remove-extra-paragraphs test, which has 2 divs, each containing <p>s)

Yanking:
* Block-level containers at the smallest. (Any smaller, and you're pulling out parts of paragraphs, not entire paragraphs.) mergedInnerTextNakedOrInInInlineTags might make this superfluous.


Advantages over readability:
* State clearly contained
* Should work fine with ideographic languages and others that lack space-delimited words
* Pluggable
* Potential to have rules generated or tuned by training
* Adaptable to find things other than the main body text
* Potential to perform better since it doesn't have to run over and over, loosening constraints each time, if it fails
