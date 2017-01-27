# Fathom

[![Build Status](https://travis-ci.org/mozilla/fathom.svg?branch=master)](https://travis-ci.org/mozilla/fathom)
[![Coverage Status](https://coveralls.io/repos/github/mozilla/fathom/badge.svg?branch=master)](https://coveralls.io/github/mozilla/fathom?branch=master)

Find meaning in the web.

## Introduction

Fathom is a JavaScript framework for extracting meaning from web pages, identifying parts like Previous/Next buttons, address forms, and the main textual content—or classifying a page as a whole. Essentially, it scores DOM nodes and extracts them based on conditions you specify. A Prolog-inspired system of types and annotations expresses dependencies between scoring steps and keeps state under control. It also provides the freedom to extend existing sets of scoring rules without editing them directly, so multiple third-party refinements can be mixed together.

## Why?

A study of existing projects like Readability and Distiller suggests that purely imperative approaches to semantic extraction get bogged down in the mechanics of DOM traversal and state accumulation, obscuring the operative parts of the extractors and making new ones long and tedious to write. They are also brittle due to the promiscuous profusion of state. Fathom is an exploration of whether we can make extractors simpler and more extensible by providing a declarative framework around these weak points. In short, Fathom handles tree-walking, execution order, and annotation bookkeeping so you don't have to.

### Specific Areas We Address

* Browser-native DOM nodes are mostly immutable, and `HTMLElement.dataset` is string-typed, so storing arbitrary intermediate data on nodes is clumsy. Fathom addresses this by providing the Fathom node (or **fnode**, pronounced fuh-NODE), a proxy around each DOM node which we can scribble on.
* With imperative extractors, any experiments or site-specific customizations must be hard-coded in. On the other hand, Fathom's **rulesets** (the programs you write in Fathom) are unordered and thereby decoupled, stitched together only by the **types** they consume and emit. External rules can thus be plugged into existing rulesets, making it easy to experiment without maintaining a fork—or to provide dedicated rules for particularly intractable web sites.
* Types provide an easy way to categorize DOM nodes. They are also Fathom's black-box units of abstraction, as functions are in other programming languages. Complex extractors can begin by attaching broad types to nodes and then narrowing to more specific ones as they are examined more closely. (Each type implicitly provides a hook point to interpose additional rules.) Relationships between type-taggings can also be harnessed through logical operators like `and`, and, in the future, `or`, `not`, and `contains`, building higher levels of abstraction.
* The type system also makes explicit the division between a ruleset's public and private APIs: the types are public, and the imperative activity that goes on inside callback functions is private. Third-party rules can use the types as hook points to interpose themselves.
* Persistent state is cordoned off in typed **notes** on fnodes. Thus, when a rule declares that it takes such-and-such a type as input, it can rightly assume (if rules are written consistently) there will be a note of that type on the fnodes that are passed in.

### Bonus Features

* Efficient execution, driven by a query planner that understands inter-rule dependencies
* Lazy execution, so you can have arbitrarily large rulesets with impunity
* Caching to keep from re-deriving intermediate results between queries
* Clustering based on a notion of DOM node distance influenced by structural similarity
* Many handy utils from which to compose scoring callbacks

## Using Fathom

### Where It Works

Fathom works against the DOM API, so you can use it server-side with `jsdom` (which the test harness uses) or another implementation, or you can embed it in a browser and pass it a native DOM. Experimentally, you can also pass in a subtree of a DOM.

Kate Hudson has put together [a Firefox add-on that lets you see the results of Fathom 1.0 rulesets against the currently loaded page](https://github.com/k88hudson/ffmetadata), as a new pane of the Developer Tools.

Michael Comella [got Fathom 1.0 running on Android](https://github.com/mcomella/fathom-android-experiments), returning results to Java via a WebView.


### The Language

Think of Fathom as a tiny programming language that recognizes the significant parts of DOM trees by means of its programs, Fathom rulesets. A ruleset is an unordered bag of rules, each of which takes in DOM nodes and annotates them with scores, types, and notes to influence future rules. At the end of the chain of rules, out pops one or more pieces of output—typically high-scoring nodes of certain types—to inform the surrounding imperative program.

This simple ruleset finds DOM nodes that could contain a useful page title and scores them according to how likely that is:

```javascript
const rules = ruleset(
    // Give any title tag the (default) score of 1, and tag it as title-ish:
    rule(dom('title'), type('titley')),

    // Give any OpenGraph meta tag a score of 2, and tag it as title-ish as well:
    rule(dom('meta[property="og:title"]'), type('titley').score(2)),

    // Take all title-ish things, and punish them if they contain
    // navigational claptrap like colons or dashes:
    rule(type('titley'), score(fnode => containsColonsOrDashes(fnode.element) ? .5 : 1)),

    // Offer the max-scoring title-ish node under the output key "title":
    rule(type('titley').max(), out('title'))
);
```

See below for a full definition of `type`, `score`, and the rest of the Fathom language.

### Rules, Sides, and Flows

Each rule is shaped like `rule(left-hand side, right-hand side)`. The **left-hand side** (LHS) pulls in one or more DOM nodes as input: either ones that match a certain CSS selector (`dom(...)`) or ones tagged with a certain type by other rules (`type(...)`). The **right-hand side** (RHS) then decides what to do with those nodes: assigning an additional type, scaling the score, scribbling a note on it, or some combination thereof. Envision the rule as a pipeline, with the DOM flowing in one end, nodes being picked and passed along to RHSs which twiddle them, and then finally falling out right side, where they might flow into other rules whose LHSs pick them up.

It's snakey sort of flow. This rule, which takes in fnodes that have previously been identified as text containers and adds a word-count annotation...

```
rule(type('textContainer'), type('countedWords').note(fnode => fnode.element.textContent.split(/\s+/).length))
```

...can be thought of as...

```
textContainer fnodes emitted        assign "countedWords" type
     from other rules          ->        and a word count        ->   changed nodes --\
                                                                                      |
 ____________________________________________________________________________________ /
/
|
\->  other rules' LHSs         ->   ...                          ->   ...          -->  ...
```

Remember that Fathom's rulesets are unordered, so any rule's output can flow into any other rule, not just ones that happen to come lexically after it.

### Pulling Out Answers

Once the ruleset is defined, run a DOM tree through it:

```javascript
var dom = jsdom.jsdom("<html><head>...</html>"));
// Tell the ruleset which DOM to run against, yielding a factbase about the document:
var facts = rules.against(dom);
// A DOM subtree can be passed in instead, if you like:
var subtreeFacts = rules.against(dom.body.firstElementChild);
```

Then, pull the answers out of the factbase: in this case, we want the max-scoring title, which the ruleset conveniently stores under the "title" output key:

```javascript
const bestTitle = facts.get('title');
```

If the ruleset doesn't anticipate the output you want, you can ask for it more explicitly by passing a full LHS to `get`. For example, if you simply want all the title-ish things so you can do further computation on them...

```javascript
const allTitles = facts.get(type('titley'));
```

Or if you have a reference to a DOM element from elsewhere in your program, you can look up the scores, types, and notes Fathom attached to it:

```javascript
const fnode = facts.get(dom.getElementById('aTitle'));
```

## Reference

### Left-hand Sides

Left-hand sides are currently a few special forms which select nodes to be fed to right-hand sides.

#### `and`(*typeCall*, *[typeCall, ...]*)
Experimental. Take nodes that conform to multiple conditions at once. For example: `and(type('title'), type('english'))`

Caveats: `and` supports only simple `type` calls as arguments for now, and it may fire off more rules as prerequisites than strictly necessary. `not` and `or` don't exist yet, but you can express `or` the long way around by having 2 rules with identical RHSs.

#### `dom`(*cssSelector*)
Take nodes that match a given DOM selector. Example: `dom('meta[property="og:title"]')`

#### `max`()
Of the nodes selected by the calls to the left, take the highest-scoring one. Example: `type('titley').max()`

#### `type`(*theType*)
Take nodes that have the given type. Example: `type('titley')`


### Right-hand Sides

A right-hand side is a strung-together series of calls like `type('smoo').props(blah).type('whee').score(2)`. Calls layer together like sheets of transparent acetate: if there are repeats, as with `type` in the previous example, the rightmost takes precedence. Similarly, if `props`, which can return multiple properties of a fact (element, note, score, and type), is missing any of these properties, we continue searching to the left for any call that provides them (excepting other `props` calls—if you want that, write a combinator, and use it to combine the 2 functions you want).

A good practice is to use more declarative calls—`score`, `note`, and `type`—as much as possible and save `props` for when you need it. The query planner can get more out of the more specialized calls without you having to tack on verbose hints like `atMost` or `typeIn`.

#### `atMost`(*score*)
Declare that the maximum returned score multiplier is such and such, which helps the optimizer plan efficiently. This doesn't force it to be true; it merely throws an error at runtime if it isn't. To lift an `atMost` constraint, call `atMost()` (with no args).

The reason `atMost` and `typeIn` apply until explicitly cleared is so that, if someone used them for safety reasons on a lexically distant rule you are extending, you won't stomp on their constraint and break their invariants accidentally.

#### `conserveScore`()
Base the scores this RHS applies on the scores of the input nodes rather than starting over from 1.

For now, there is no way to turn this back off (for example with a later application of `props` or `conserveScore(false)`).

#### `props`(*callback*)
Determine any of type, note, score, and element using a callback. This overrides any previous call to `props` and, depending on what properties of the callback's return value are filled out, may override the effects of other previous calls as well.

The callback should return...

* An optional score multiplier
* A type (required on `dom(...)` rules, defaulting to the input one on `type(...)` rules)
* Optional notes
* An element, defaulting to the input one. Overriding the default enables a callback to walk around the tree and say things about nodes other than the input one.

For example...

```javascript
function callback(fnode) {
    return [{score: 3,
             element: fnode.element,  // unnecessary, since this is the default
             type: 'texty',
             note: {suspicious: true}}];
}
```

If you use `props`, Fathom cannot look inside your callback to see what type you are emitting, so you must declare your output types with `typeIn` or set a single static type with `type`. Fathom will complain if you don't. (You can still opt not to return any type if the node turns out not to be a good match, even if you declare a `typeIn`.

#### `note`(*callback*)
Whatever the callback returns (even `undefined`) becomes the note of the fact. This overrides any previous call to `note`.

Since every node can have multiple, independent notes (one for each type), this applies to the type explicitly set by the RHS or, if none, to the type named by the `type` call on the LHS. If the LHS has none because it's a `dom(...)` LHS, an error is raised.

When you query for fnodes of a certain type, you can expect to find notes of any form you specified on any RHS with that type. If no note is specified, it will be undefined. However, if two RHSs emits a given type, one adding a note and the other not adding one (or adding an undefined one), the meaningful note overrides the undefined one. This allows elaboration on a RHS's score (for example) without needing to repeat note logic.

Indeed, `undefined` is not considered a note. So, though notes cannot in general be overwritten, a note that is `undefined` can. Symmetrically, an `undefined` returned from a `note` or `props` or the like will quietly decline to overwrite an existing defined note, where any other value would cause an error. Rationale: letting `undefined` be a valid note value would mean you couldn't shadow a leftward note in a RHS without introducing a new singleton value to serve as a "no value" flag. It's not worth the complexity and the potential differences between the (internal) fact and fnode note value semantics.

Best practice: any rule adding a type should apply the same note. If only one rule of several type-foo-emitting ones did, it should be made to emit a different type instead so downstream rules can explicitly state that they require the note to be there. Otherwise, there is nothing to guarantee the note-adding rule will run before the note-needing one.

#### `out`(*key*)
Expose the output of this rule's LHS as a "final result" to the surrounding program. It will be available by calling `.get(key)` on the ruleset. You can run the nodes through a callback function first by adding `.through(callback)`; see below.

#### `through`(*callback*)
Append `.through` to `.out` to run the nodes emitted from the LHS through an arbitrary function before returning them to the containing program. Example: `out('titleLengths').through(fnode => fnode.noteFor('title').length)`

#### `score`(*scoreOrCallback*)
Multiply the score of the input node by some number, which can be >1 to increase the score or <1 to decrease it. `scoreOrCallback` can either be a static number or else a callback which takes the fnode and returns a number.

Since every node can have multiple, independent scores (one for each type), this applies to the type explicitly set by the RHS or, if none, to the type named by the `type` call on the LHS. If the LHS has none because it's a `dom(...)` LHS, an error is raised.

#### `type`(*theType*)
Apply the type *theType* to processed by this RHS. This overrides any previous call to `type`.

#### `typeIn`(*type*, *[type, ...]*)
Constrain this rule to emit 1 of a set of given types. This overrides any previous call to `typeIn`. Pass no args to lift a previous `typeIn` constraint, as you might do when basing a LHS on a common value to factor out repetition.

`typeIn` is mostly a hint for the query planner when you're emitting types dynamically from `props` calls—in fact, an error will be raised if `props` is used without a `typeIn` or `type` to constrain it—but it also checks conformance at runtime to ensure validity.

### Clustering

Fathom also provides a hierarchal clustering algorithm that helps you group nodes into clusters based on their proximity and similarity of ancestral structure:

```javascript
const {cluster} = require('fathom/utils');
theClusters = clusters(anArrayOfNodes, 4);
```

In the above, 4 is the distance beyond which Fathom will decide nodes belong in separate clusters. Turn it up to more aggressively invite nearby nodes into a cluster. Turn it down to keep a stricter definition of "nearby".

Various factors influence the measured distance between nodes. The first is the obvious one: topological distance, the number of steps along the DOM tree from one node to another.

The second is structural similarity. In the following, the divs `a` and `b` are farther apart…

```
<center>
    <div id="a">
    </div>
</center>
<div>
    <div id="b">
    </div>
</div>
```

…than they would be if the `center` tag were a `div` as well:

```
<div>
    <div id="a">
    </div>
</div>
<div>
    <div id="b">
    </div>
</div>
```

Third is depth disparity. Nodes are considered farther from each other if they are not the same distance from the root.

Finally is the presence of "stride" nodes, which are (1) siblings or (2) siblings of ancestors that lie
between 2 nodes. Each of these interposed nodes make it less likely that the 2 nodes should be together in a cluster.

At present, the costs for each factor are constants in the `distance` function. They will become settable in a future release.

## Tests and Examples

[Our tests](https://github.com/mozilla/fathom/tree/master/test), especially [demos.js](https://github.com/mozilla/fathom/blob/master/test/demos.js), are replete with examples exercising every corner of Fathom.

To run the tests, run...

```
npm test
```

This will also run the linter and analyze test coverage. You can find the coverage report in the `coverage` directory and the HTML version under `coverage/lcov-report/index.html`.

If you're in the midst of a tornado of rapid development and the fancy stuff is too slow, you can invoke `make test` to run "just the tests, ma'am".

## Support

Join us in IRC if you have questions: #fathom on irc.mozilla.org. Or open an issue on GitHub.

## Version History

### 2.0
The focii for 2.0 are syntactic sugar and support for larger, more powerful rulesets that can operate at higher levels of abstraction. From these priorities spring all of the following:

* "Yankers" or aggregate functions are now part of the ruleset: `max` for now, more in a later release. This in-ruleset mapping from the fuzzy domain of scores back to the boolean domain of types lets ruleset authors choose between efficiency and completeness. It also opens the door to automatic optimization down the road.
* Answers are computed lazily, running only the necessary rules each time you say `get(...)` and caching intermediate results to save work on later calls. We thus eschew 1.x's strategy of emitting the entire scored world for the surrounding imperative program to examine and instead expose a factbase that acts like a lazy hash of answers. This allows for large, sophisticated rulesets that are nonetheless fast and can be combined to reuse parts (see `Ruleset.rules()`). Of course, if you still want to imbibe the entire scored corpus of nodes in your surrounding program, you can simply yank all nodes of a type using the `type` yanker: just point it to `out`, and the results will be available from the outside: `rule(type('foo'), out('someKey'))`.
* We expand the domain of concern of a ruleset from a single dimension ("Find just the ads!") to multiple ones ("Find the ads and the navigation and the products and the prices!"). This is done by making scores and notes per-type.
* The rule syntax has been richly sugared to…
    * be both shorter and easier to read in most cases
    * surface more info declaratively so the query planner can take advantage of it (`props` is where the old-style ranker functions went, but avoid them when you don't need that much power, and you'll reap a reward of concision and efficiently planned queries)
    * allow you to concisely factor up repeated parts of complex LHSs and RHSs
* Test coverage is greatly improved, and eslint is keeping us from doing overtly stupid things.

#### Backward-incompatible changes

* RHSs (née ranker functions) can no longer return multiple facts, which simplifies both syntax and design. For now, use multiple rules, each emitting one fact, and share expensive intermediate computations in notes. If this proves a problem in practice, we'll switch back, but I never saw anyone return multiple facts in the wild.
* Scores are now per-type. This lets you deliver multiple independent scores per ruleset. It also lets Fathom optimize out downstream rules in many cases, since downstream rules' scores no longer back-propagate to upstream types. Per-type scores also enable complex computations with types as composable units of abstraction, open the possibility of over-such-and-such-a-score yankers, and make non-multiplication-based score components a possibility. However, the old behavior remains largely available via `conserveScore`.
* Flavors are now types.

### 1.1.2
* Stop assuming querySelectorAll() results conform to the iterator protocol. This fixes compatibility with Chrome.
* Add test coverage reporting.

### 1.1.1
* No changes. Just bump the version in an attempt to get the npm index page to update.

### 1.1
* Stop using `const` in `for...of` loops. This lets Fathom run within Firefox, which does not allow this due to a bug in its ES implementation.
* Optimize DistanceMatrix.numClusters(), which should make clustering a bit faster.

### 1.0
* Initial release
