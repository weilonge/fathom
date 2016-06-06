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


// Return the next sibling node of `element`, skipping over text nodes that
// consist wholly of whitespace.
function isWhitespace(element) {
    return (element.nodeType === element.TEXT_NODE &&
            element.textContent.trim().length === 0);
}


// Return the number of stride nodes between 2 DOM nodes *at the same
// level of the tree*, without going up or down the tree.
//
// Stride nodes are {(1) siblings or (2) siblings of ancestors} that lie
// between the 2 nodes. These interposed nodes make it less likely that the 2
// nodes should be together in a cluster.
//
// left xor right may also be undefined.
function numStrides(left, right) {
    let num = 0;

    // Walk right from left node until we hit the right node or run out:
    let sibling = left;
    let shouldContinue = sibling && sibling !== right;
    while (shouldContinue) {
        sibling = sibling.nextSibling;
        if ((shouldContinue = sibling && sibling !== right) &&
            !isWhitespace(sibling)) {
            num += 1;
        }
    }
    if (sibling !== right) {  // Don't double-punish if left and right are siblings.
        // Walk left from right node:
        sibling = right;
        while (sibling) {
            sibling = sibling.previousSibling;
            if (sibling && !isWhitespace(sibling)) {
                num += 1;
            }
        }
    }
    return num;
}


// Return a distance measurement between 2 DOM nodes.
//
// I was thinking of something that adds little cost for siblings.
// Up should probably be more expensive than down (see middle example in the Nokia paper).
function distance(elementA, elementB) {
    // TODO: Test and tune these costs. They're off-the-cuff at the moment.
    //
    // Cost for each level deeper one is than the other below their common
    // ancestor:
    const DIFFERENT_DEPTH_COST = 2;
    // Cost for a level below the common ancestor where tagNames differ:
    const DIFFERENT_TAG_COST = 2;
    // Cost for a level below the common ancestor where tagNames are the same:
    const SAME_TAG_COST = 1;
    // Cost for each stride node between A and B:
    const STRIDE_COST = 1;

    if (elementA === elementB) {
        return 0;
    }

    // Stacks that go from the common ancestor all the way to A and B:
    const aAncestors = [elementA];
    const bAncestors = [elementB];

    let aAncestor = elementA;
    let bAncestor = elementB;

    // Ascend to common parent, stacking them up for later reference:
    while (!aAncestor.contains(elementB)) {
        aAncestor = aAncestor.parentNode;
        aAncestors.push(aAncestor);
    }

    // Make an ancestor stack for the right node too so we can walk
    // efficiently down to it:
    do {
        bAncestor = bAncestor.parentNode;  // Assumes we've early-returned above if A === B.
        bAncestors.push(bAncestor);
    } while (bAncestor !== aAncestor);

    // Figure out which node is left and which is right, so we can follow
    // sibling links in the appropriate directions when looking for stride
    // nodes:
    let left = aAncestors;
    let right = bAncestors;
    // In compareDocumentPosition()'s opinion, inside implies after. Basically,
    // before and after pertain to opening tags.
    const comparison = elementA.compareDocumentPosition(elementB);
    let cost = 0;
    let mightStride;
    if (comparison & elementA.DOCUMENT_POSITION_FOLLOWING) {
        // A is before, so it could contain the other node.
        mightStride = !(comparison & elementA.DOCUMENT_POSITION_CONTAINED_BY)
        left = aAncestors;
        right = bAncestors;
    } else if (comparison & elementA.DOCUMENT_POSITION_PRECEDING) {
        // A is after, so it might be contained by the other node.
        mightStride = !(comparison & elementA.DOCUMENT_POSITION_CONTAINS)
        left = bAncestors;
        right = aAncestors;
    }

    // Descend to both nodes in parallel, discounting the traversal
    // cost iff the nodes we hit look similar, implying the nodes dwell
    // within similar structures.
    while (left.length || right.length) {
        const l = left.pop();
        const r = right.pop();
        if (l === undefined || r === undefined) {
            // Punishment for being at different depths: same as ordinary
            // dissimilarity punishment for now
            cost += DIFFERENT_DEPTH_COST;
        } else {
            // TODO: Consider similarity of classList.
            cost += l.tagName === r.tagName ? SAME_TAG_COST : DIFFERENT_TAG_COST;
        }
        if (mightStride) {
            cost += numStrides(l, r) * STRIDE_COST;
        }
    }

    return cost;
}


// The Nokia paper starts with all nodes being their own cluster, then merges adjacent clusters that have minimal cost-of-merge (C(x, y)), then repeats until minimal cost-of-merge is infinity (that is, disallowed).
// They keep siblings together by punishing mergings proportional to the number of nodes they repeat. (Segmentations always go all the way to the root.)

// Divide the given nodes into one or more clusters by position in the DOM tree.
// Maybe later we'll consider score or notes.
//
// Worst case: every node is in its own cluster.
// function clusters(nodes) {
//
// }



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
