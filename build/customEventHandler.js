/**
 * Event handler to send custom event to custom reporter to generate json
 * Usage:
 * Include customEventHandler file
 * const CustomEventHandler = new (require(testConfig.reporterDir + 'customEventHandler'))(__filename);
 *
 * Outside of describe (for spec file)
 * CustomEventHandler.setMainFeature(text);
 * CustomEventHandler.setMainCategory(text);
 * CustomEventHandler.setMainSubCategory(text);
 *
 * Test specific (within it() function only)
 * CustomEventHandler.setTestFeature(this, text);
 * CustomEventHandler.setTestCategory(this, text);
 * CustomEventHandler.setTestSubCategory(this, text);
 */
class CustomEventHandler {
    constructor(filename) {
        if (typeof filename === 'undefined') {
            throw new Error('Unable to process event as filename is missing');
        }
        this.filename = filename;
    }

    /**
     * To store key 'feature' in main suite
     * @param {String} value text value
     */
    setMainFeature(value) {
        if (typeof value !== 'string') {
            throw new Error('Unable to accept value other than string as an input for Main Feature event');
        }
        this._mainEvent('feature', value);
    }

    /**
     * To store key 'category' in main suite
     * @param {String} value text value
     */
    setMainCategory(value) {
        if (typeof value !== 'string') {
            throw new Error('Unable to accept value other than string as an input for Main Category event');
        }
        this._mainEvent('category', value);
    }

    /**
     * To store key 'sub_category' in main suite
     * @param {String} value text value
     */
    setMainSubCategory(value) {
        if (typeof value !== 'string') {
            throw new Error('Unable to accept value other than string as an input for Main Sub-category event');
        }
        this._mainEvent('sub_category', value);
    }

    /**
     * Send an event for custom json reporter to process and store in json.
     * this accepts key value pair that populated in main suite of json
     * @param  {String} key   json object
     * @param  {String} value json object value
     */
    _mainEvent(key, value) {
        process.send({
            event: 'custom:main',
            file: this.filename,
            key: key,
            value: value
        });
    }

    /**
     * To store key 'feature' in test
     * @param {Object} testObj test object which is current test that is currently running
     * @param {String} value text value
     */
    setTestFeature(obj, value) {
        this._testEvent(obj, 'feature', value);
    }

    /**
     * To store key 'category' in test
     * @param {Object} testObj test object which is current test that is currently running
     * @param {String} value text value
     */
    setTestCategory(obj, value) {
        this._testEvent(obj, 'category', value);
    }

    /**
     * To store key 'sub_category' in test
     * @param {Object} testObj test object which is current test that is currently running
     * @param {String} value text value
     */
    setTestSubCategory(obj, value) {
        this._testEvent(obj, 'sub_category', value);
    }

    /**
     * Send an event for custom json reporter to process and store in json.
     * Event generated is specific to given test only
     * @param  {Object} testObj test object which is current test that is currently running
     * @param  {String} key     json object
     * @param  {String} value   json object value
     */
    _testEvent(testObj, key, value) {
        if (Object.keys(testObj.test).length > 0) {
            if (typeof this.filename !== 'undefined' || typeof testObj.test.title !== 'undefined' || typeof testObj.test.parent.title !== 'undefined') {
                process.send({
                    event: 'custom:test',
                    file: this.filename,
                    title: testObj.test.title,
                    parent: testObj.test.parent.title,
                    key: key,
                    value: value
                });
            } else {
                throw new Error('Test suite name, Test name or/and test filename are missing');
            }
        } else {
            throw new Error('Test event should be called from it() function only');
        }
    }
}

module.exports = WdioCustomEventHandler;