/**
 * Created by Daniel on 2015-04-19.
 */
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var fs = require('fs');
var crypto = require('crypto');
var validator = require('validator');
var uuid = require('node-uuid');

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
        secure: true
    },
    secret: '45635264203668688740286450',
    resave: false,
    saveUninitialized: true
}));

// Engine that interprets the data sent in forms.
app.use(bodyParser.json({}));
app.use(bodyParser.urlencoded({extended: true}));



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

// Login
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
// form submit manager
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
        req.session.user = {loggedIn:true};
        res.json({});
    } catch (e) {
        res.json({error: 'Could not log you in.'});
    }
});

// Logout
app.get('/logout', function(req, res) {
    req.session.destroy();
    res.render('pages/logout', {
    });
});


// Signup
app.get('/signup', function(req, res) {
    res.render('pages/signup', {
        user: req.session.user
    });
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
                error: '404'
            });
            break;
        default:
            res.render('pages/error', {
                error: err.message
            });
    }
});

// start the application listening
//var privateKey  = fs.readFileSync('sslcert/localhost.key', 'utf8');
//var certificate = fs.readFileSync('sslcert/localhost.cert', 'utf8');
//var credentials = {key: privateKey, cert: certificate};
var httpServer = http.createServer(app);
httpServer.listen(80);



/*// require https
var httpRedirect = http.createServer(function (req, res) {
    // TODO change this when we get a url
    res.writeHead(302, {'Location': 'https://localhost' + req.url});
    res.end();
});*/
//httpRedirect.listen(80);
