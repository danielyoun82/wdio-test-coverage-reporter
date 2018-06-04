//const util = require('util');
const events = require('events');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
//const HtmlTestResultGenerator = require ('./htmlTestResultGenerator');
//const HtmlCoverageReportGenerator = require ('./htmlCoverageReportGenerator');
const uuidv4 = require('uuid/v4');

/**
 * Custom Reporter to generate test result with custom event into json
 * note: all hooks are ignored (for now)
 * @extends events
 */
class WdioTestCoverageReporter extends events.EventEmitter {
    constructor(baseReporter, config, options = {}) {
        super();

        this.baseReporter = baseReporter;
        this.config = config;
        this.options = options;
        this.mainEvents = [];
        this.testEvents = [];
        this.suiteEvents = [];
        this.resultCount = [];

        const { epilogue } = this.baseReporter;

        /* event type */
        this.on('custom:test', function (customInfo) {
            this.testEvents.push(customInfo);
        });

        this.on('custom:main', function (customInfo) {
            this.mainEvents.push(customInfo);
        });

        this.on('runner:screenshot', function (screenshotEvent) {
            // event being fired by browser.saveScreenshot() with file name.
            // test runner will perform this on failure, it can also be
            // done via browser.saveScreenshot() command
            this.testEvents.push(screenshotEvent);
        });

        this.on('suite:end', function (suite) {
            // there can only be one parent describe/context per spec file
            // so any subsequent describe block will be regarded as a child
            const currSuite = {
                'cid': suite.cid,
                'title': suite.title,
                'parent': suite.parent,
                'file': suite.file
            };

            this.suiteEvents.push(currSuite);
        });

        this.on('end', function (setting) {
            const overview = {
                'host': this.config.host,
                'port': this.config.port,
                'targetUrl': this.config.baseUrl,
                'waitTimeout': this.config.waitforTimeout,
                'reportOutput': this.options.outputDir,
                //base reporter count is somehow incorrect
                'testCount': this.baseReporter.stats.counts.tests,
                'passCount': this.baseReporter.stats.counts.passes,
                'failCount': this.baseReporter.stats.counts.failures,
                'skipCount': this.baseReporter.stats.counts.pending,
                'unknownCount': 0,
                'start': this.baseReporter.stats.start,
                'end': this.baseReporter.stats.end,
                'duration': this.baseReporter.stats._duration,
                'browser': setting.capabilities[0].browserName,
                'maxInstances': setting.capabilities[0].maxInstances
            };

            const overallResult = {
                overview: overview,
                suites: []
            };

            // Capture all suites and tests details, all hooks are ignored
            const tempSuites = {};
            let combinedTotTests = 0;
            let combinedTotPass = 0;
            let combinedTotFail = 0;
            let combinedTotSkip = 0;
            let combinedTotUnknown = 0;

            for (const cid of Object.keys(this.baseReporter.stats.runners)) {
                const runnerDetail = this.baseReporter.stats.runners[cid];

                for (const specId of Object.keys(runnerDetail.specs)) {
                    const specDetail = runnerDetail.specs[specId];
                    const fileName = specDetail.files[0];

                    let totTests = 0;
                    let totPass = 0;
                    let totFail = 0;
                    let totSkip = 0;
                    let totUnknown = 0;

                    for (const suiteName of Object.keys(specDetail.suites)) {
                        const suiteDetail = specDetail.suites[suiteName];
                        const currSuite = this.buildSuite(cid, fileName, suiteDetail);
                        const uTestId = uuidv4();

                        tempSuites[uTestId] = currSuite;

                        if (!(suiteDetail.title.includes('"before all" hook') || suiteDetail.title.includes('"after all" hook'))) {
                            for (const testName of Object.keys(suiteDetail.tests)) {
                                const testDetail = suiteDetail.tests[testName];

                                // create test result json and add events
                                const testResult = this.buildTest(cid, suiteDetail.title, testDetail);
                                const combinedResult = this.processTestEvents(testResult, this.testEvents);

                                tempSuites[uTestId].tests[testDetail.title] = combinedResult;

                                switch (testDetail.state) {
                                    case 'pass':
                                        totPass++;
                                        combinedTotPass++;
                                        break;
                                    case 'fail':
                                        totFail++;
                                        combinedTotFail++;
                                        break;
                                    case 'pending':
                                        totSkip++;
                                        combinedTotSkip++;
                                        break;
                                    default:
                                        // unknown state
                                        totUnknown++;
                                        combinedTotUnknown++;
                                        break;
                                }
                                totTests++;
                                combinedTotTests++;
                            }
                        }
                        this.resultCount[fileName] = { 'testCount': totTests, 'passCount': totPass, 'failCount': totFail, 'skipCount': totSkip, 'unknownCount': totUnknown };
                    }
                }
            }
            /* To remedy base reporter's count which is somehow incorrect */
            overallResult.overview.testCount = combinedTotTests;
            overallResult.overview.passCount = combinedTotPass;
            overallResult.overview.failCount = combinedTotFail;
            overallResult.overview.skipCount = combinedTotSkip;
            overallResult.overview.unknownCount = combinedTotUnknown;

            const consolidatedSuites = this.consolidateAdditionalSuiteInfo(tempSuites, this.suiteEvents);
            const suitesWithHierarchy = this.flatToHierarchy(consolidatedSuites);
            const suitesWithCustomEvents = this.processMainEvents(suitesWithHierarchy, this.mainEvents);
            const suitesWithTestStateCount = this.attachStateCount(suitesWithCustomEvents);

            overallResult.suites = suitesWithTestStateCount;

            this.write(overallResult);

            //new HtmlTestResultGenerator(overallResult); // create test result report
            //new HtmlCoverageReportGenerator(overallResult); // create coverage report

            epilogue.call(baseReporter);
        });
    }

    /**
     * Write test result in json file
     * @param  {String} json json file name
     */
    write(json) {
        if (!this.options || typeof this.options.outputDir !== 'string') {
            return console.log(`Cannot write custom json report: outputDir is empty or invalid [${this.options.outputDir}].`);
        }

        try {
            const dir = path.resolve(this.options.outputDir);
            let reportFilename = this.options.reportFilename ? this.options.reportFilename : 'result.json';

            reportFilename = reportFilename.indexOf('.json') >= 0 ? reportFilename : reportFilename + '.json'; // if filename is missing .json

            const jsonFilepath = path.join(dir, reportFilename);

            mkdirp.sync(dir);
            fs.writeFileSync(jsonFilepath, JSON.stringify(json, null, 4)); //prettify json
            console.log(`Wrote custom json report to [${this.options.outputDir}].`);
        } catch (e) {
            console.log(`Failed to write custom json report to [${this.options.outputDir}]. Error: ${e}`);
        }
    }

    /**
     * Create json object for suites -> describe()/context()
     * @param  {String} cid       Id related to concurrency
     * @param  {String} fileName  file that suite belongs to
     * @param  {JSONObject} suiteData current suite information
     * @return {JSONObject}           customised suite information
     */
    buildSuite(cid, fileName, suiteData) {
        const suites = {
            'cid': cid,
            'start': suiteData.start,
            'end': suiteData.end,
            'duration': suiteData._duration,
            'title': suiteData.title,
            'uid': suiteData.uid,
            'file': fileName,
            'tests': {}
        };

        return suites;
    }

    /**
     * Function to add additional information regarding suite hierarchy
     * @param  {JSONObject} allSuites   Suites information gathered from result
     * @param  {JSONObject} suiteEvents Suites information gathered when 'suite:end' event fired
     * @return {JSONObject}             Combined result that contain suite parent information
     */
    consolidateAdditionalSuiteInfo(allSuites, suiteEvents) {
        for (const suite of Object.keys(allSuites)) {
            for (const suiteEvent of Object.keys(suiteEvents)) {
                if (allSuites[suite].title === suiteEvents[suiteEvent].title && allSuites[suite].file === suiteEvents[suiteEvent].file) {
                    allSuites[suite].parent = suiteEvents[suiteEvent].parent;
                }
            }
        }
        return allSuites;
    }

    /**
     * Create json object for test result -> it()
     * @param  {String} cid      Id related to concurrency
     * @param  {String} suiteName parent of test
     * @param  {JSONObject} testdata current test information
     * @return {JSONObject}          customised test information
     */
    buildTest(cid, suiteName, testdata) {
        const test = {
            'cid': cid,
            'start': testdata.start,
            'end': testdata.end,
            'duration': testdata._duration,
            'parent': suiteName,
            'title': testdata.title,
            'uid': testdata.uid,
            'error': {},
            'screenshot': []
        };

        // maybe just use state as is
        if (testdata.state === 'pending') {
            test.pending = true;
        } else if (testdata.state === 'pass') {
            test.pass = true;
        } else if (testdata.state === 'fail') {
            test.fail = true;
        } else {
            test.unknown_state = true;
        }

        if (testdata.error) {
            test.error.name = testdata.error.type;
            test.error.message = testdata.error.message;
            test.error.stack = testdata.error.stack;
            if (typeof testdata.error.actual !== 'undefined' && typeof testdata.error.expected !== 'undefined') {
                test.error.actual = testdata.error.actual;
                test.error.expected = testdata.error.expected;
            }
        }

        return test;
    }

    /**
     * Attach any custom test event and screenshot events to corresponding test
     * @param  {JSONObject} testResult json data with all relevant test result
     * @param  {JSONArray} events json array of all events related to tests
     * @return {JSONObject} json data with test result including all relevant events
     */
    processTestEvents(testResult, events) {
        const eventToRemove = [];
        // Attach events to test
        for (const index of Object.keys(events)) {
            if (testResult.cid === events[index].cid && testResult.title === events[index].title && testResult.parent === events[index].parent) {
                //unlikely to have different parent, but just to make sure
                if (events[index].event === 'runner:screenshot') {
                    if (typeof events[index].filename !== 'undefined') {
                        const filePath = events[index].filename.split('/');
                        const fileOnly = filePath[filePath.length - 1];

                        testResult.screenshot.push(fileOnly);
                    }
                }
                if (events[index].event === 'custom:test') {
                    testResult[events[index].key] = events[index].value;
                }
                eventToRemove.push(index);
            }
        }

        // remove processed events
        for (let i = eventToRemove.length - 1; i >= 0; i -= 1) {
            events.splice(eventToRemove[i], 1);
        }

        return testResult;
    }

    /**
     * Attach any custom events to main suite i.e. file
     * @param  {JSONArray} suiteInfo json data with suite information
     * @param  {JSONArray} events    json data wieh all events relevant to suite
     * @return {JSONArray}          json suite data combined with custom events
     */
    processMainEvents(suiteInfo, events) {
        const eventToRemove = [];

        // Attach events to test
        for (const filename of Object.keys(suiteInfo)) {
            const currSuite = suiteInfo[filename];

            for (const index of Object.keys(events)) {
                if (currSuite.cid === events[index].cid && currSuite.file === events[index].file) {
                    currSuite[events[index].key.replace(/-/g, '_')] = events[index].value;
                }
                eventToRemove.push(index);
            }
        }

        // remove processed events
        for (let i = eventToRemove.length - 1; i >= 0; i -= 1) {
            events.splice(eventToRemove[i], 1);
        }

        return suiteInfo;
    }

    /**
     * Attach total test result count to root suite
     * @param  {Object} resultJson test result
     * @return {Object}            test result with total count attached
     */
    attachStateCount(resultJson) {
        for (const spec of Object.keys(this.resultCount)) {
            const specResult = this.resultCount[spec];

            for (const rootSuite of Object.keys(resultJson)) {
                if (spec === rootSuite) {
                    resultJson[rootSuite].testCount = specResult.testCount;
                    resultJson[rootSuite].passCount = specResult.passCount;
                    resultJson[rootSuite].failCount = specResult.failCount;
                    resultJson[rootSuite].skipCount = specResult.skipCount;
                    resultJson[rootSuite].unknownCount = specResult.unknownCount;
                }
            }
        }
        return resultJson;
    }

    /**
     * Convert non-hierarchy suites into parent child pair
     * @param  {JSONObject} flat json data that contains all suites
     * @return {JSONObject}      json data with hierarchy
     */
    flatToHierarchy(flat) {
        const roots = {}; // things without parent

        // convert array to json key:object pair, if not in that format
        //const all = {}; // make them accessible by parent on this map
        //flat.forEach(function (item) {
        //    all[item.title] = item;
        //});

        // connect childrens to its parent, and split roots apart
        let rootParent, currParent;

        Object.keys(flat).forEach(function (uuid) {
            const item = flat[uuid];

            if (typeof rootParent === 'undefined') {
                rootParent = uuid; //to indicate base suite for all suites - based on file
            }

            if (typeof currParent === 'undefined') {
                currParent = uuid; //current parent in case parent information is not available
            }

            if (typeof item.parent !== 'undefined') {
                if (item.parent === item.title) {
                    roots[item.file] = item;
                    rootParent = uuid;
                    currParent = uuid;
                } else {
                    let parentUuid = null;

                    // necessary step due to change in key for json array to uuid due to tests that have same names
                    Object.keys(flat).forEach(function (uuid_2) {
                        if (flat[uuid_2].title === item.parent && flat[uuid].file === item.file) {
                            parentUuid = uuid_2;
                        }
                    });

                    // to be safe, unlikely to happen
                    if (parentUuid !== null) {
                        const p = flat[parentUuid];

                        currParent = parentUuid;

                        if (!('nestedSuites' in p)) {
                            p.nestedSuites = [];
                        }
                        p.nestedSuites.push(item);
                    }
                }
            } else {
                const p = flat[currParent];

                if (!('nestedSuites' in p)) {
                    p.nestedSuites = [];
                }
                p.nestedSuites.push(item);
            }
        });
        return roots;
    }
}

module.exports = WdioTestCoverageReporter;
