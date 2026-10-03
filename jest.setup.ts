import { configure } from '@testing-library/react-native/pure';

// A cold jest cache, which is what every CI run starts with, makes the first
// screen render in a test file spend several seconds loading React Native's
// lazily required modules. That freezes the JS thread, so waitFor's one second
// default can run out between two chained steps (a query that waits for the
// membership query) even though nothing is wrong. Tests that pass finish
// early, so a longer limit only slows a test that is really failing.
configure({ asyncUtilTimeout: 20000 });
