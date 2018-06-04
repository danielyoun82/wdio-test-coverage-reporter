const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

/**
 * Class to generate test result in html page based on json
 *
 * Improvement needed:
 * - Accept file as an input so that it can generate report from json file without running any tests
 * - Better css
 * - Create node module so that it can be used by other suites
 * -- Use react instead of jquery if possible
 * - Screenshot file location, currently it is fixed. Make it more customisable when building node module
 */
class HtmlReportGenerator {
    constructor() {
        this.html = [];
        this.json = json;
        console.log(arguments);
        console.log(json);
        if (json.constructor === Object) {
            this.write(json.overview.reportOutput, this.parseJsonToHtml(json));
        } else if (json.constructor === String) {
            if (json.includes('.json')) {
                // to accept file as input - incomplete

            }
        } else {
            console.log('Unsupported input type:' + (typeof json) + '\n' + json);
        }
    }

    /**
     * Covert json into html
     * @param  {Object} json test result in json
     * @return {String}      html page in String
     */
    parseJsonToHtml(json) {
        this.html.push(`
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="google" content="notranslate">
            <meta http-equiv="Content-Language" content="en">
            <link rel="stylesheet" href="css/result.css" />
            <script src="https://code.jquery.com/jquery-3.2.1.min.js" integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4=" crossorigin="anonymous"></script>
            <script src="https://code.jquery.com/ui/1.12.1/jquery-ui.js" integrity="sha256-T0Vest3yCU7pafRw9r+settMBX6JkKN06dqBnpQ8d30=" crossorigin="anonymous"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
          </head>
          <body>
            <div id="mySidenav" class="sidenav">
              <a href="test_result.html">Test Result</a>
              <a href="test_coverage.html">Test Coverage</a>
            </div>
            <header>
              <div class="overview">
                <h1>Test Result</h1>
                <span class=browser>Browser: ${json.overview.browser}</span>
                <span class=overview_duration>${this.msToTime(json.overview.duration)}</span>
                <div class=overview_resultcount>
                  <div class="tooltip">
                    <span class="tooltiptext">Tests</span>
                    <span class=testcount>${json.overview.testCount}</span>
                  </div>
                  <div class="tooltip">
                    <span class="tooltiptext">Passed</span>
                    <span class=passcount>${json.overview.passCount}</span>
                  </div>
                  <div class="tooltip">
                    <span class="tooltiptext">Failed</span>
                    <span class=failcount>${json.overview.failCount}</span>
                  </div>
                  <div class="tooltip">
                    <span class="tooltiptext">Skipped</span>
                    <span class=skipcount>${json.overview.skipCount}</span>
                  </div>
                  <div class="tooltip">
                    <span class="tooltiptext">Unknown State</span>
                    <span class=unknowncount>${json.overview.unknownCount}</span>
                  </div>
                </div>
              </div>
            </header>
            <div class="expand_collapse_all">
              <button onclick="showAllContents()">show all</button>
              <button onclick="hideAllContents()">hide all</button>
            </div>
        `);
        // <span id=start> Test start: ${this.getDateInCustomFormat(json.overview.start)}</span>
        //<div id=${overviewInfo}>${json.overview[overviewInfo]}</div>
        for (const suite of Object.keys(json.suites)) {
            const mainSuite = json.suites[suite];

            this.getRootSuites(mainSuite);
        }

        this.html.push(`
              <script src="js/result.js"></script>
              <footer>
                <p><i>Additional Information</i></p>
                <div class="additional_info">
                  <div id=host> Host: ${json.overview.host}:${json.overview.port}</div>
                  <div id=baseurl> BaseUrl: ${json.overview.targetUrl}</div>
                  <div id=wait_timeout> waitTimeout: ${json.overview.waitTimeout}ms</div>
                  <div id=outputDir> outputDir: ${json.overview.reportOutput}</div>
                </div>
              </footer>
          </body>
        </html>
        `);
        return this.html.join('');
    }

    /**
     * To print root suite details, calls getNestedSuites and getTests function if suites or tests are available
     * @param  {Object} obj object contains array of suites
     */
    getRootSuites(obj) {
        // base suite
        if (obj.failCount > 0) {
            this.html.push('<div class="suite root fail">');
        } else if (obj.skipCount > 0) {
            this.html.push('<div class="suite root skip">');
        } else if (obj.unknownCount > 0) {
            this.html.push('<div class="suite root unknown_state">');
        } else if (obj.passCount > 0) {
            this.html.push('<div class="suite root pass">');
        } else {
            this.html.push('<div class="suite root">');
        }
        // details
        const shortenedFileName = obj.file.split('/specs/ui/')[1];

        this.html.push(`
          <div class="description">
            <h3 class="name">${obj.title}</h3>
            <span class="duration">${this.msToTime(obj.duration)}</span>
            <span class="filename">${shortenedFileName}</span>
            <div class="resultcount">
              <span class="testcount">${obj.testCount}</span>
              <span class="passcount">${obj.passCount}</span>
              <span class="failcount">${obj.failCount}</span>
              <span class="skipcount">${obj.skipCount}</span>
              <span class="unknowncount">${obj.unknownCount}</span>
            </div>
          </div>
          <div class="suites">
          `);

        if (typeof obj.nestedSuites !== 'undefined') {
            for (const key of Object.keys(obj.nestedSuites)) {
                this.html.push('<div class="suite">');
                this.getNestedSuites(obj.nestedSuites[key]);
                this.html.push('</div>');
            }
        }

        if (typeof obj.tests !== 'undefined') {
            this.html.push('<div class="suite">');
            this.getTests(obj.tests);
            this.html.push('</div>');
        }
        this.html.push('</div>'); // suites
        this.html.push('</div>'); // root suite
    }

    /**
     * To print suite details, calls getTests function if tests are available for suite
     * @param  {Object} obj object contains array of suites
     */
    getNestedSuites(obj) {
        this.html.push(`
          <div class="description">
            <h4 class="name">${obj.title}</h4>
            <span class="duration">${this.msToTime(obj.duration)}</span>
          </div>`);

        if (typeof obj.nestedSuites !== 'undefined') {
            for (const key of Object.keys(obj.nestedSuites)) {
                this.getNestedSuites(obj.nestedSuites[key]);
            }
        }

        if (typeof obj.tests !== 'undefined') {
            this.getTests(obj.tests);
        }
    }

    /**
     * To print all test results
     * @param  {Object} obj object contains array of test results
     */
    getTests(obj) {
        for (const key of Object.keys(obj)) {
            const currTest = obj[key];

            if (typeof currTest.pass !== 'undefined') {
                this.html.push('<div class="test pass">');
            } else if (typeof currTest.fail !== 'undefined') {
                this.html.push('<div class="test fail">');
            } else if (typeof currTest.pending !== 'undefined') {
                this.html.push('<div class="test skip">');
            } else if (typeof currTest.unknown_state !== 'undefined') {
                this.html.push('<div class="test unknown_state">');
            }
            else {
                this.html.push('<div class="test">');
            }

            this.html.push(`<span class="name">${currTest.title}</span>`);

            // error
            if (typeof currTest.error.name !== 'undefined') {
                //this.html.push(currTest.error.name + ': ' + currTest.error.message + '</br>');
                this.html.push(`
                  <span class=error>
                    <pre>${currTest.error.stack}</pre>
                  </span>`
                );
            }

            // screenshots - it uses fixed path name, so screenshots need to be captured in specific location
            // e.g. './reports/js/ui/screenshots'
            // It can be changed in wdio.conf.js
            this.html.push('<span class=screenshots>');
            for (const index of Object.keys(currTest.screenshot)) {
                const imgName = currTest.screenshot[index];
                const imgPath = '../screenshots/' + imgName;

                this.html.push('<a target=_blank href=' + imgPath  + '><img height=50 width=50 src=' + imgPath + '></img></a>');
            }
            this.html.push('</span>');
            this.html.push('</div>');
        }
    }

    /**
     * Write test result in html file and export js and css file that it requires
     * @param  {String} outputDir outputDir recorded in json
     * @param  {String} html      html content string
     */
    write(outputDir, html) {
        if (!outputDir || typeof outputDir !== 'string') {
            return console.log(`Cannot write test result report: outputDir is empty or invalid [${outputDir}].`);
        }

        try {
            // html
            const dir = path.resolve(outputDir);
            const htmlFilepath = path.join(dir, 'test_result.html');

            mkdirp.sync(dir);
            fs.writeFileSync(htmlFilepath, html);

            // to allow unix shell script
            const shell = require('child_process').execSync ;

            // css
            const cssDir = path.resolve(outputDir + './css');
            const cssSrc = path.resolve(__dirname, './css');
            const cssDist = cssDir;

            shell(`mkdir -p ${cssDist}`);
            shell(`cp -r ${cssSrc}/* ${cssDist}`);

            // js
            const jsDir = path.resolve(outputDir + './js');
            const jsSrc = path.resolve(__dirname, './js');
            const jsDist = jsDir;

            shell(`mkdir -p ${jsDist}`);
            shell(`cp -r ${jsSrc}/* ${jsDist}`);

            console.log(`Wrote test result report to [${outputDir}].`);
        } catch (e) {
            console.log(`Failed to write test result report to [${outputDir}]. Error: ${e}`);
        }
    }

    /**
     * Covert milliseconds into hrs, mins, secs format
     * @param  {Integer} s time in milliseconds
     * @return {String}   time in 00:00:00 or 0s format
     */
    msToTime(s) {
        const ms = s % 1000;

        s = (s - ms) / 1000;
        const secs = s % 60;

        s = (s - secs) / 60;
        const mins = s % 60;
        const hrs = (s - mins) / 60;

        if (hrs <= 0 && mins <= 0) {
            return secs + '.' + ms + 's';
        } else if (hrs <= 0 && mins >= 0) {
            return mins + ':' + secs;
        } else {
            return hrs + ':' + mins + ':' + secs;
        }
    }

    /**
     * To display date in custom format
     * @param  {String} dateInString date in string format
     * @return {String}              formatted date string
     */
    getDateInCustomFormat(dateInString) {
        const d = new Date(dateInString);

        return `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}-${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
    }
}

module.exports = HtmlReportGenerator;
