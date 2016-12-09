# Fathom

[![Build Status](https://travis-ci.org/mozilla/fathom.svg?branch=master)](https://travis-ci.org/mozilla/fathom)
[![Coverage Status](https://coveralls.io/repos/github/mozilla/fathom/badge.svg?branch=master)](https://coveralls.io/github/mozilla/fathom?branch=master)

Find meaning in the web.

## Introduction

Fathom is an experimental framework for extracting meaning from web pages, identifying parts like Previous/Next buttons, address forms, and the main textual content. Essentially, it scores DOM nodes and extracts them based on conditions you specify. A Prolog-inspired system of types and annotations expresses dependencies between scoring steps and keeps state under control. It also provides the freedom to extend existing sets of scoring rules without editing them directly, so multiple third-party refinements can be mixed together.

## Why?

A study of existing projects like Readability and Distiller suggests that purely imperative approaches to semantic extraction get bogged down in the mechanics of DOM traversal and state accumulation, obscuring the operative parts of the extractors and making new ones long and tedious to write. They are also brittle due to the promiscuous profusion of state. Fathom is an exploration of whether we can make extractors simpler and more extensible by providing a declarative framework around these weak points. In short, Fathom handles tree-walking, execution order, and annotation bookkeeping so you don't have to.

Here are some specific areas we address:

* Browser-native DOM nodes are mostly immutable, and `HTMLElement.dataset` is string-typed, so storing arbitrary intermediate data on nodes is clumsy. Fathom addresses this by providing the Fathom node (or **fnode**, pronounced fuh-NODE), a proxy around each DOM node which we can scribble on.
* With imperative extractors, any experiments or site-specific customizations must be hard-coded in. Fathom's **rulesets** (the programs you write in Fathom), on the other hand, are unordered and thereby decoupled, stitched together only by the **types** they consume and emit. External rules can thus be plugged into existing rulesets, making it easy to experiment (without maintaining a fork) or to provide dedicated rules for particularly intractable web sites.
* Types provide a convenient way of categorizing DOM nodes. They are the black-box units of abstraction, as functions are in many other programming languages. For the moment, complex extractors can begin by attaching broad types to nodes and then narrowing to more specific ones as they are examined more closely. This provides hook points to interpose external rules. In the future, simple type-taggings will be able to be combined using logical operators like `and`, `or`, and `contains`, building arbitrarily sophisticated conclusions.
* The type system also makes explicit the division between an extractor's public and private APIs: the types are public, and the imperative stuff that goes on inside callback functions is private. Third-party rules can use the types as hook points to interpose themselves.
* Persistent state is cordoned off in typed **notes** on fnodes. Thus, when a rule declares that it takes such-and-such a type as input, it can rightly assume (if rules are written consistently) there will be a note of that type on the fnodes that are passed in.

## Status

Fathom is under heavy development, and its design is still in flux. If you'd like to use it at such an early stage, you should remain in close contact with us. Join us in IRC: #fathom on irc.mozilla.org.

### Parts that work so far

* "Rank" phase: scoring of nodes found with a CSS selector
* Type-driven rule dispatch
* A simple "yanker" or two
* A notion of DOM node distance influenced by structural similarity
* Clustering based on that distance metric
* Query planning for lazy execution
* Concise rule definitions

### Not there yet

* Efficient planning for answering max() queries
* Logical operators for combining types

### Environments

Fathom works against the DOM API, so you can use it server-side with `jsdom` (which the test harness uses) or another implementation, or you can embed it in a browser and pass it a native DOM.

## Example

Think of Fathom as a tiny programming language that recognizes the significant parts of DOM trees by means of its programs, Fathom rulesets. A ruleset is an unordered bag of rules, each of which takes in DOM nodes and annotates them with scores, types, and notes to influence future rules. At the end of the chain of rules, out pops one or more pieces of output—typically high-scoring nodes of certain types—to inform the surrounding imperative program.

This simple ruleset one finds DOM nodes that could contain a useful page title and scores them according to how likely that is:

```javascript
var rules = ruleset(
    // Give any title tag the (default) score of 1, and tag it as title-ish:
    rule(dom('title'), type('titley')),

    // Give any OpenGraph meta tag a score of 2, and tag it as title-ish as well:
    rule(dom('meta[og:title]'), type('titley').score(2)),

    // Take all title-ish things, and punish them if they contain
    // navigational claptrap like colons or dashes:
    rule(type('titley'), func(node => {score: containsColonsOrDashes(node.element) ? .5 : 1})),

    // Offer the max-scoring title-ish node under the output key "title":
    rule(type('titley').max(), out('title'))
);
```

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

Once the ruleset is defined, run a DOM tree through it:

```javascript
// Tell the ruleset which DOM to run against, yielding a factbase about the document.
var facts = rules.against(jsdom.jsdom("<html><head>...</html>"));
```

Then, pull the answers out of the factbase: in this case, we want the max-scoring title, which the ruleset conveniently stores under the "title" output key:

```javascript
var bestTitle = facts.get('title');
```

If the ruleset doesn't anticipate the output you want, you can ask for it more explicitly by passing a full LHS to `get()`. For example, if you simply want all the title-ish things so you can do further computation on them...

```javascript
var allTitles = facts.get(type('titley'));
```

Or if you have a reference to a DOM element somehow, you can look up the scores, types, and notes Fathom attached to it:

```javascript
var fnode = facts.get(dom.getElementById('aTitle'));
```

## Reference

### LHSs


### RHSs

If a RHS sets a note or a score without explicitly setting a type, the type from the `type()` call of the LHS is assumed. If the LHS has none because it's a `dom()` LHS, an error is raised.

To do:
- precedence rules (rightmost same-named wins)
- definitions of unmentioned calls
- optimizer hints like maxScore() and typeIn()

#### Notes

`undefined` is not considered a note. So, though notes cannot in general be overwritten, a note that is `undefined` can. Symmetrically, an `undefined` returned from a `.note()` or `.func()` or the like will quietly decline to overwrite an existing defined note, where any other value would cause an error. Rationale: letting `undefined` be a valid note value would mean you couldn't shadow a leftward note in a RHS without introducing a new singleton value to serve as a "no value" flag. It's not worth the complexity and the potential differences between fact and fnode note value semantics.


#### `func()`

The `func()` call returns...

* An optional score multiplier
* A type (required on dom() rules, defaulting to the input one on type() rules)
* Optional notes
* An element, defaulting to the input one. Overriding the default enables a ranker to walk around the tree and say things about nodes other than the input one.

For example...

```javascript
function callback(fnode) {
    return [{score: 3,
             element: fnode.element,  // unnecessary, since this is the default
             type: 'texty',
             note: {suspicious: true}}];
}
```

If you use `func()`, Fathom cannot look inside your callback to see what type you are emitting, so you must declare your output types with `typeIn()` or set a single static type with `type()`. Fathom will complain if you don't.

### Clustering

Fathom also provides a hierarchal clustering algorithm that helps you group nodes into clusters based on their proximity and similarity of ancestral structure:

```javascript
const {cluster} = require('fathom/utils');
theClusters = clusters(anArrayOfNodes, 4);
// 4 is the distance beyond which Fathom will decide nodes belong in separate
// clusters. Turn it up to more aggressively invite nearby nodes into a
// cluster. Turn it down to keep a stricter definition of "nearby".
```

## Best Practices

Any rule adding a type should apply the same note. If only one rule of several `*→a` ones did, it should be made to emit a different type instead so downstream rules can explicitly state that they require the note to be there. Otherwise, there is nothing to guarantee the note-adding rule will run before the note-needing one.

## More Examples

Our docs are a little sparse so far, but [our tests](https://github.com/mozilla/fathom/tree/master/test) might help you in the meantime.

## Tests

To run the tests, run...

```
npm test
```

This will also run the linter and analyze test coverage. You can find the coverage report in the `coverage` directory and the HTML version under `coverage/lcov-report/index.html`.

If you're in the midst of a tornado of rapid development and the fancy stuff is too slow, you can invoke `make test` to run "just the tests, ma'am".


## Version History

### 2.0
The focii for 2.0 are syntactic sugar and support for larger-scale, more powerful rulesets. Everything else falls out of those.

Fathom 2.0 pulls yankers (max(), for now) into the ruleset, opening the opportunity for automatic optimization. It's also computes answers lazily, running only the necessary rules each time you say `get()` (and caching intermediate results to save work on later calls). It's thus eschews 1.x's strategy of emitting the entire scored world for the surrounding imperative program to examine and instead exposes a fact base that just acts like a lazy hash of useful answers. This opens the door to large, sophisticated rulesets that are still fast and, someday, can have parts reused.

Fathom 2.0 enables optimization within the rule executor to make short-circuiting sets of rules efficient. It also introduces new yankers like `max()`, which provide a way to map assertions about fuzzy scores down to the boolean statements of type: it's a "cut", and it helps with ruleset efficiency. Of course, if you still want to imbibe the entire scored corpus of nodes in your surrounding program, you can simply yank all nodes of a type the `type()` yanker: just point it to `out('someKey')`, and the results will appear in the yanked data under that key.

It's also lazy.

It also expands the domain of concern of a ruleset from a single dimension ("Find just the ads!") to multiple ones ("Find the ads and the navigation and the products and the prices!"), if you like.

It sugars the RHS syntax to…
* be both shorter and easier to read in a lot of cases and
* perhaps more importantly, surface more info declaratively so the optimizer can take advantage of it
* allow you to concisely factor up repeated parts of complex RHSs

#### Backward-incompatible changes

* Ranker functions can no longer return multiple facts, which simplifies both syntax and design. For now, use multiple rules, each emitting one fact, and share expensive intermediate computations in notes. If this proves a problem in practice, we'll switch back, but I never saw anyone return multiple facts in the wild.
* Scores are now per-type. This lets you deliver multiple independent scores per ruleset. It also lets Fathom optimize out downstream rules in many cases, since downstream rules' scores no longer back-propagate to upstream types. In the future, per-type scores will enable complex computations with types as composable units of abstraction, open the possibility of over-such-and-such-a-score yankers, and make non-multiplication-based score factors a possibility. The old behavior remains largely available (TODO: cite the syntax), with a few corner-case exceptions (overlapping dom() selectors?).

### 1.0
* Initial release

### 1.1
* Stop using `const` in `for...of` loops. This lets Fathom run within Firefox, which does not allow this due to a bug in its ES implementation.
* Optimize DistanceMatrix.numClusters(), which should make clustering a bit faster.

### 1.1.1
* No changes. Just bump the version in an attempt to get the npm index page to update.

### 1.1.2
* Stop assuming querySelectorAll() results conform to the iterator protocol. This fixes compatibility with Chrome.
* Add test coverage reporting.