=================
Utility Functions
=================

In addition to components intrinsically tied to rulesets, Fathom comes with a variety of utility procedures for building scoring and other callback functions.

Clustering
==========

Fathom provides a hierarchal clustering algorithm that helps you group nodes into clusters based on their proximity and similarity of ancestral structure.

.. autofunction:: clusters

   Example:

   .. code-block:: js

      const {cluster} = require('fathom/utils');
      theClusters = clusters(anArrayOfNodes, 4);

   In the above, 4 is the distance beyond which Fathom will decide nodes belong in separate clusters. Turn it up to more aggressively invite nearby nodes into a cluster. Turn it down to keep a stricter definition of "nearby".

   Various factors influence the measured distance between nodes. The first is the obvious one: topological distance, the number of steps along the DOM tree from one node to another.

   The second is structural similarity. In the following, the divs ``a`` and ``b`` are farther apart…

   .. code-block:: html

      <center>
          <div id="a">
          </div>
      </center>
      <div>
          <div id="b">
          </div>
      </div>

   …than they would be if the ``center`` tag were a ``div`` as well:

   .. code-block:: html

      <div>
          <div id="a">
          </div>
      </div>
      <div>
          <div id="b">
          </div>
      </div>

   Third is depth disparity. Nodes are considered farther from each other if they are not the same distance from the root.

   Finally is the presence of "stride" nodes, which are (1) siblings or (2) siblings of ancestors that lie
   between 2 nodes. Each of these interposed nodes make it less likely that the 2 nodes should be together in a cluster.

   At present, the costs for each factor are constants in the :func:`distance` function. They will become settable in a future release.

.. autofunction:: distance

Other
=====

.. autofunction:: best
.. autofunction:: collapseWhitespace
.. autofunction:: first
.. autofunction:: getDefault
.. autofunction:: identity
.. autofunction:: inlineTextLength
.. autofunction:: inlineTexts
.. autofunction:: isBlock
.. autofunction:: isWhitespace
.. autofunction:: length
.. autofunction:: linkDensity
.. autofunction:: max
.. autofunction:: maxes
.. autofunction:: min
.. autoclass:: NiceSet
.. autofunction:: numberOfMatches
.. autofunction:: page
.. autofunction:: reversed
.. autofunction:: rootElement
.. autofunction:: setDefault
.. autofunction:: sum
.. autofunction:: toposort
.. autofunction:: walk
