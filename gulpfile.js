'use strict';

var production = false;

const 	gulp 			= require('gulp'),
		gulpif 			= require('gulp-if'),
		pug 			= require('gulp-pug'),
		rename 			= require('gulp-rename'),
		browserSync 	= require('browser-sync'),
		stylus 			= require('gulp-stylus'),
		postcss			= require('gulp-postcss'),
		autoprefixer 	= require('autoprefixer-core'),
		notify 			= require('gulp-notify'),
		concat 			= require('gulp-concat'),
		foreach 		= require('gulp-foreach'),
		sourcemaps 		= require('gulp-sourcemaps'),
		clean 			= require('gulp-clean'),
		uglify 			= require('gulp-uglify'),
		merge 			= require('gulp-merge'),
		gcmq 			= require('gulp-group-css-media-queries'),
		cssnano 		= require('gulp-cssnano');

gulp.task('js', function() {
	return gulp.src('app/pages/*/*.js')
		.pipe(foreach(function(stream, file) {
			console.log('js-file:', file.basename);
			return merge(gulp.src([
					//'app/common/script.js',
					'app/pages/*/*.js',
					'app/components/*/*.js'
				]), stream)
				.pipe(gulpif(!production, sourcemaps.init()))
				.pipe(concat(file.basename))
				.pipe(gulpif(production, uglify()))
				.pipe(gulpif(!production, sourcemaps.write()))
				.pipe(rename({ dirname: '' }))
		}))
		.pipe(gulp.dest('dist/js'))
});

gulp.task('stylus', function() {
	return gulp.src('app/pages/*/*.styl')
		.pipe(foreach(function(stream, file) {
			console.log('styl-file:', file.basename);
			return merge(gulp.src([
				'app/common/styles.styl',
				'app/pages/*/*.styl',
				'app/components/**/*.styl'
			]), stream)
			.pipe(gulpif(!production, sourcemaps.init()))
			.pipe(concat(file.basename))
			.pipe(stylus({
				'include css': true
				// 'compress': production
			}))
			.on('error', notify.onError("Error: <%= error.message %>"))
			.pipe(postcss([ autoprefixer({ browsers: ["> 0%"] }) ]))
			.pipe(gulpif(production, gcmq()))
			.pipe(gulpif(production, cssnano()))
			.pipe(gulpif(!production, sourcemaps.write()))
			.pipe(rename({ dirname: '' }))
		}))
		.pipe(gulp.dest('dist/css'))
		.pipe(browserSync.reload({ stream: true }))
});

gulp.task('pug', function(done) {
	return gulp.src('app/pages/*/*.pug')
		.pipe(foreach(function(stream, file) {
			console.log('pug-file:', file.basename);
			return stream
				.pipe(pug({
					basedir: 'app',
					pretty: '\t',
					locals: {
						filename: file.basename.split('.')[0]
					}
				}))
				.on('error', notify.onError("Error: <%= error.message %>"))
				.pipe(rename({ dirname: '' }))
		}))
		.pipe(gulp.dest('dist'))
});

gulp.task('images', function(done) {
	return gulp.src('app/images/**/*')
		.pipe(gulp.dest('dist/images'))
});

gulp.task('libs', function(done) {
	return gulp.src('app/libs/**/*')
		.pipe(gulp.dest('dist/libs'))
});

gulp.task('fonts', function(done) {
	return gulp.src('app/fonts/**/*')
		.pipe(gulp.dest('dist/fonts'))
});

gulp.task('clean:dist', function() {
	return gulp.src('dist', {read: false})
		.pipe(clean())
});

gulp.task('build', gulp.series(function(done) { production = true; done(); }, 'clean:dist', gulp.parallel('pug', 'stylus', 'js', 'images')));

gulp.task('default', gulp.series('clean:dist', gulp.parallel('pug', 'stylus', 'js', 'images', 'libs', 'fonts'), function server(done) {

	browserSync({
		server: {
			baseDir: 'dist'
		},
		notify: false,
		open: false
	});

	gulp.watch('app/**/*.styl', gulp.series('stylus'));
	gulp.watch(['app/**/*.js', '!app/libs/**/*'], gulp.series('js'));
	gulp.watch('app/images/**/*', gulp.series('images'));
	gulp.watch('app/libs/**/*', gulp.series('libs'));
	gulp.watch('app/fonts/**/*', gulp.series('fonts'));

	gulp.watch(['app/**/*.pug'], gulp.series('pug', function(done) {

		browserSync.reload();
		done();

	}));

	done();

}));