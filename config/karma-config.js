module.exports = function(config) {
	config.set({

		basePath: '../',

		frameworks: ['jasmine'],

		files: [
			'src/assets/js/lib/*.js',
			'src/assets/js/lib/**/angular.min.js',
			'src/assets/js/lib/**/angular-*.js',
			'src/assets/js/utility/helpers.js',
			'src/assets/js/errors.js',
			'src/assets/js/definitions.js',
			'src/assets/js/*.js',
			'src/assets/js/**/*.js',
			'tests/**/*.js'
		],

		exclude: [],

		colors: true,

		logLevel: config.LOG_INFO,

		browsers: ['Chrome'],

		captureTimeout: 5000,

		singleRun: false,
			
		reportSlowerThan: 500

	});
};


