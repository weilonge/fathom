const {forEach, map} = require('wu');


// Return the sum of an iterable, as defined by the + operator.
function sum(iterable) {
    let total;
    let isFirst = true;
    forEach(
        function assignOrAdd(addend) {
            if (isFirst) {
                total = addend;
                isFirst = false;
            } else {
                total += addend;
            }
        },
        iterable);
    return total;
}


// Iterate, depth first, over a DOM node. Return the original node first.
// shouldTraverse - a function on a node saying whether we should include it
//     and its children
function *walk(element, shouldTraverse) {
    yield element;
    for (const child of element.childNodes) {
        if (shouldTraverse(child)) {
            for (const w of walk(child, shouldTraverse)) {
                yield w;
            }
        }
    }
}


const blockTags = new Set();
forEach(blockTags.add.bind(blockTags),
        ['ADDRESS', 'BLOCKQUOTE', 'BODY', 'CENTER', 'DIR', 'DIV', 'DL',
         'FIELDSET', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
         'ISINDEX', 'MENU', 'NOFRAMES', 'NOSCRIPT', 'OL', 'P', 'PRE',
         'TABLE', 'UL', 'DD', 'DT', 'FRAMESET', 'LI', 'TBODY', 'TD',
         'TFOOT', 'TH', 'THEAD', 'TR', 'HTML']);
// Return whether a DOM element is a block element by default (rather
// than by styling).
function isBlock(element) {
    return blockTags.has(element.tagName);
}


// Yield strings of text nodes within a normalized DOM node and its
// children, without venturing into any contained block elements.
//
// shouldTraverse: A function that specifies additional elements to
//     exclude by returning false
function *inlineTexts(element, shouldTraverse = element => true) {
    // TODO: Could we just use querySelectorAll() with a really long
    // selector rather than walk(), for speed?
    for (const child of walk(element,
                             element => !(isBlock(element) ||
                                          element.tagName === 'SCRIPT' &&
                                          element.tagName === 'STYLE')
                                        && shouldTraverse(element))) {
        if (child.nodeType === child.TEXT_NODE) {
            // wholeText() is not implemented by jsdom, so we use
            // textContent(). The result should be the same, since
            // we're calling it on only text nodes, but it may be
            // slower. On the positive side, it means we don't need to
            // normalize the DOM tree first.
            yield child.textContent;
        }
    }
}


function inlineTextLength(element, shouldTraverse = element => true) {
    return sum(map(text => collapseWhitespace(text).length,
                   inlineTexts(element, shouldTraverse)));
}


function collapseWhitespace(str) {
    return str.replace(/\s{2,}/g, ' ');
}


// Return the ratio of the inline text length of the links in an
// element to the inline text length of the entire element.
function linkDensity(node) {
    const length = node.flavors.get('paragraphish').inlineLength;
    const lengthWithoutLinks = inlineTextLength(node.element,
                                                element => element.tagName !== 'A');
    return (length - lengthWithoutLinks) / length;
}


// The Nokia paper starts with all nodes being their own cluster, then merges adjacent clusters that have minimal cost-of-merge (C(x, y)), then repeats until minimal cost-of-merge is infinity (that is, disallowed).
// They keep siblings together by punishing mergings proportional to the number of nodes they repeat. (Segmentations always go all the way to the root.)

// Return a distance measurement between 2 DOM nodes.
//
// left: the node a depth-first, post-order traversal would hit first. (This will matter only if we later make this care about sibling-skipping. // XXX: walk() is pre-order, I think.
//
// I was thinking of something that adds little cost for siblings.
// Also consider similarity of tagName and classList.
// Up should probably be more expensive than down (see middle example in the Nokia paper).
function distance(elementA, elementB) {
    let aAncestor = elementA;
    let bAncestor = elementB;
    const aAncestors = [];
    const bAncestors = [];

    // Ascend to common parent, stacking them up for later reference:
    while (!aAncestor.contains(elementB)) {
        aAncestor = aAncestor.parentNode;
        aAncestors.push(aAncestor);
    }

    // Make an ancestor stack for the right node too so we can walk
    // efficiently down to it:
    while (bAncestor !== aAncestor) {
        bAncestor = bAncestor.parentNode;
        bAncestors.push(bAncestor);
    }

    // Descend to both nodes in parallel, discounting the traversal
    // cost iff the nodes we hit look similar, implying the nodes dwell
    // within similar structures:
    let longer = aAncestors,
        shorter = bAncestors;
    let cost = 0;
    if (longer.length < shorter.length) {
        [longer, shorter] = [shorter, longer];
    }
    // None of the following cost numbers are tested or tuned yet.
    while (shorter.length) {
        const l = longer.pop();
        const s = shorter.pop();
        cost += (l.tagName === s.tagName) ? 1 : 2;
    }
    cost += longer.length * 2;  // Punishment for being at different depths: same as ordinary dissimilarity punishment for now

    return cost;

    // TODO: As we descend, we can use compareDocumentPosition() to tell which one's to the left, then walk from it nextSiblingward until we hit the right or run out of nodes (that'll take care of both the first level, when they'll be siblings, and others, when they won't), penalizing along the way. Actually, maybe count siblings between them on the first level, then just count additional nodes to the right of the left one and to the left of the right one at each later level.
    // TODO: Every time we ascend, keep track of how many siblings we've skipped over and add a proportionate penalty.
    // Note: for compareDocumentPosition(), inside implies after. Basically, before and after pertain to opening tags.
}


module.exports = {
    collapseWhitespace,
    distance,
    inlineTextLength,
    inlineTexts,
    isBlock,
    linkDensity,
    sum,
    walk
};
