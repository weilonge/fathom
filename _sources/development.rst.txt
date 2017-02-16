===========
Development
===========

Tests and Examples
==================

`Our tests <https://github.com/mozilla/fathom/tree/master/test>`_, especially `demos.js <https://github.com/mozilla/fathom/blob/master/test/demos.js>`_, are replete with examples exercising every corner of Fathom.

To run the tests, run... ::

    npm test

This will also run the linter and analyze test coverage. You can find the coverage report in the ``coverage`` directory and the HTML version under ``coverage/lcov-report/index.html``.

If you're in the midst of a tornado of rapid development and the fancy stuff is too slow, you can invoke ``make test`` to run "just the tests, ma'am".
