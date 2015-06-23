/**
 * Created by Daniel on 2015-04-19.
 */
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var fs = require('fs');
var crypto = require('crypto');
var multer = require('multer');

var http = require('http');

/*
Initialize the application.
Initialize middleware.
 */

var app = express();

// Set the templating engine and the template directory
app.set('views', __dirname + '/../views');
app.set('view engine', 'ejs');
// Sets the templating function
app.engine('html', require('ejs').renderFile);

// Engine that manages sessions, it manages the cookie for us so we do not need to worry about cookies.
app.use(session({
    cookie:{
        secure: false
    },
    secret: '45635264203668688740286450',
    resave: false,
    saveUninitialized: true
}));

// Engine that interprets the data sent in forms.
app.use(bodyParser.json({}));
app.use(bodyParser.urlencoded({extended: true}));
// Engine that parses uploads
app.use(multer({
    dest: __dirname + '/../static/slides',
    inMemory: false,
    rename: function (fieldname, filename) {
        return Date.now();
    },
    onFileUploadStart: function (file, req, res) {
        if (!req.session.user) {
            req.failed = 'Not logged in.';
            return false;
        }
        if (!file.originalname.match(/.*((\.jpg)|(\.jpeg)|(\.gif)|(\.png))/)){
            req.failed = 'Bad file type.';
            return false;
        }
    },
    onFileUploadComplete: function (file, req, res) {
        req.uploaded = true;
    }
}));


/*
Set up routes, login management.
 */

// static route
app.use('/static', express.static('static'));

// Homepage
app.get('/', function(req, res){
    res.render('pages/display', {
        user: req.session.user
    });
});

// Admin
// display page
app.get('/admin', function(req, res) {
    if (req.session.user) {
        res.render('pages/admin', {
            user: req.session.user
        });
    }else{
        res.render('pages/login', {});
    }
});

// AJAX functions
// reset
app.post('/reset', function(req, res) {
    if (req.session.user) {
        try {
            fs.writeFileSync(__dirname + '/../data/state.json', fs.readFileSync(__dirname + '/../data/reset.json'));
        } catch(e){
            res.json({error: 'No reset file found.'});
            return;
        }
        res.json({});
    } else {
        res.json({error: 'Not logged in.'});
    }
});
// get settings
app.post('/get', function(req, res) {
    res.json(JSON.parse(fs.readFileSync(__dirname + '/../data/state.json')));
});
// settings update
app.post('/set', function(req, res) {
    if (req.session.user) {
        fs.writeFileSync(__dirname + '/../data/state.json', JSON.stringify(req.body.newState));
        res.json({message: 'Settings saved.'});
    } else {
        res.json({error: 'Not logged in.'});
    }
});
// upload
app.post('/upload', function(req, res) {
    if (req.uploaded){
        res.json({img: '/static/slides/' + req.files.picture.name});
    }else if(req.failed){
        res.json({error: req.failed});
    }else {
        res.json({error: 'Unknown error.'});
    }
});
// login
app.post('/login', function(req, res) {
    if (req.session.user) {
        res.json({});
        return;
    }
    var username = req.body.username;
    var password = req.body.password;
    if(password == "") {
        res.json({error: 'Please enter your password.'});
        return;
    }
    try {
        var user = JSON.parse(fs.readFileSync(__dirname + '/../users/' + username + '.json'));
        var shasum = crypto.createHash('sha512');
        shasum.update(password + user.id, 'utf8');
        if (user.password !== shasum.digest('hex')) {
            throw 0;
        }
        req.session.user = {loggedIn: true, name:username};
        res.json({});
    } catch (e) {
        res.json({error: 'Could not log you in.'});
    }
});
// Password reset
app.post('/password-reset', function(req, res) {
    if (!req.session.user) {
        res.json({error:'Not logged in.'});
        return;
    }
    var oldPassword = req.body.oldPassword;
    var newPassword = req.body.newPassword;
    var newPasswordRepeat = req.body.newPasswordRepeat;
    if(oldPassword == "" || newPassword == "" || newPasswordRepeat == "") {
        res.json({error: 'Please fill all fields.'});
        return;
    }
    if(oldPassword.length < 6 || newPassword.length < 6 || newPasswordRepeat.length < 6) {
        res.json({error: 'All passwords must be at least 6 characters long.'});
        return;
    }
    if(newPassword != newPasswordRepeat){
        res.json({error:'Passwords do not match.'});
        return;
    }
    try {
        var user = JSON.parse(fs.readFileSync(__dirname + '/../users/' + req.session.user.name + '.json'));
        var shasum = crypto.createHash('sha512');
        shasum.update(oldPassword + user.id, 'utf8');
        if (user.password !== shasum.digest('hex')) {
            throw 0;
        }
        shasum = crypto.createHash('sha512');
        shasum.update(newPassword + user.id, 'utf8');
        user.password = shasum.digest('hex');
        fs.writeFileSync(__dirname + '/../users/' + req.session.user.name + '.json', JSON.stringify(user));
        res.json({});
    } catch (e) {
        res.json({error: 'Incorrect password.'});
    }
});
// Logout
app.post('/logout', function(req, res) {
    req.session.destroy();
    res.json({});
});



// Error handling
app.get('*', function(req, res, next) {
    var err = new Error();
    err.status = 404;
    next(err);
});
app.use(function(err, req, res, next) {
    switch(err.status) {
        case 404:
            res.render('pages/error', {
                status: '404',
                message: 'Page not found.'
            });
            break;
        default:
            res.render('pages/error', {
                status: err.status,
                message: err.message
            });
    }
});

// start the application listening
//var privateKey  = fs.readFileSync('sslcert/localhost.key', 'utf8');
//var certificate = fs.readFileSync('sslcert/localhost.cert', 'utf8');
//var credentials = {key: privateKey, cert: certificate};
var httpServer = http.createServer(app);
console.log((process.env.OPENSHIFT_NODEJS_PORT || 80) + " " + (process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1"));
httpServer.listen(process.env.OPENSHIFT_NODEJS_PORT || 80, process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");