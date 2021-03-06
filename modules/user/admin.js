module.exports = function(app) {
    // Sort order hash
    var sort_cells = {
            username: 1,
            realname: 1,
            email: 1,
            status: 1
        },
        sort_cell_default = 'username',
        sort_cell_default_mode = 1;
    // Set items per page for this module
    var items_per_page = 30;
    //
    var router = app.get('express').Router(),
        path = require('path'),
        crypto = require('crypto'),
        ObjectId = require('mongodb').ObjectID,
        i18nm = new(require('i18n-2'))({
            locales: app.get('config').locales.avail,
            directory: path.join(__dirname, 'lang'),
            extension: '.js',
            devMode: app.get('config').locales.dev_mode
        });
    router.get_module_name = function(req) {
        i18nm.setLocale(req.session.current_locale);
        return i18nm.__("module_name");
    };
    router.get('/', function(req, res) {
        i18nm.setLocale(req.session.current_locale);
        if (!req.session.auth || req.session.auth.status < 2) {
            req.session.auth_redirect_host = req.get('host');
            req.session.auth_redirect = '/cp/users';
            res.redirect(303, "/auth/cp?rnd=" + Math.random().toString().replace('.', ''));
            return;
        }
        var body = app.get('renderer').render_file(path.join(__dirname, 'views'), 'user_control', {
            lang: i18nm
        }, req);
        app.get('cp').render(req, res, {
            body: body,
            css: '<link rel="stylesheet" href="/modules/user/css/main.css">'
        }, i18nm, 'users', req.session.auth);
    });
    router.post('/data/list', function(req, res) {
        i18nm.setLocale(req.session.current_locale);
        var rep = {
            ipp: items_per_page
        };
        var skip = req.body.skip;
        var query = req.body.query;
        var sort_mode = req.body.sort_mode;
        var sort_cell = req.body.sort_cell;
        if (typeof skip != 'undefined') {
            if (!skip.match(/^[0-9]{1,10}$/)) {
                rep.status = 0;
                rep.error = i18nm.__("invalid_query");
                res.send(JSON.stringify(rep));
                return;
            }
        }
        if (typeof query != 'undefined') {
            if (!query.match(/^[\w\sА-Яа-я0-9_\-\.]{3,40}$/)) {
                rep.status = 0;
                rep.error = i18nm.__("invalid_query");
                res.send(JSON.stringify(rep));
                return;
            }
        }
        // Check authorization
        if (!req.session.auth || req.session.auth.status < 2) {
            rep.status = 0;
            rep.error = i18nm.__("unauth");
            res.send(JSON.stringify(rep));
            return;
        }
        var sort = {};
        sort[sort_cell_default] = sort_cell_default_mode;
        if (typeof sort_cell != 'undefined') {
            if (typeof sort_cells[sort_cell] != 'undefined') {
                sort = {};
                sort[sort_cell] = 1;
                if (typeof sort_mode != 'undefined' && sort_mode == -1) {
                    sort[sort_cell] = -1;
                }
            }
        }
        // Get users from MongoDB
        rep.items = [];
        var find_query = {};
        if (query) {
            find_query = {
                $or: [{
                    username: new RegExp(query, 'i')
                }, {
                    realname: new RegExp(query, 'i')
                }]
            };
        }
        app.get('mongodb').collection('users').find(find_query).count(function(err, items_count) {
            if (!err && items_count > 0) {
                rep.total = items_count;
                app.get('mongodb').collection('users').find(find_query, {
                    skip: skip,
                    limit: items_per_page
                }).sort(sort).toArray(function(err, items) {
                    if (typeof items != 'undefined' && !err) {
                        // Generate array
                        for (var i = 0; i < items.length; i++) {
                            var arr = [];
                            arr.push(items[i]._id);
                            arr.push(items[i].username);
                            arr.push(items[i].realname);
                            arr.push(items[i].email);
                            arr.push(parseInt(items[i].status));
                            rep.items.push(arr);
                        }
                    }
                    // Return results
                    rep.status = 1;
                    res.send(JSON.stringify(rep));
                }); // data
            } else { // Error or count = 0
                rep.status = 1;
                rep.total = '0';
                res.send(JSON.stringify(rep));
            }
        }); // count
    });
    router.post('/data/load', function(req, res) {
        i18nm.setLocale(req.session.current_locale);
        var rep = {};
        var user_id = req.body.id;
        if (typeof user_id == 'undefined' || !user_id.match(/^[a-f0-9]{24}$/)) {
            rep.status = 0;
            rep.error = i18nm.__("invalid_query");
            res.send(JSON.stringify(rep));
            return;
        }
        // Check authorization
        if (!req.session.auth || req.session.auth.status < 2) {
            rep.status = 0;
            rep.error = i18nm.__("unauth");
            res.send(JSON.stringify(rep));
            return;
        }
        // Get users from MongoDB
        rep.user = {};
        app.get('mongodb').collection('users').find({
            _id: new ObjectId(user_id)
        }, {
            limit: 1
        }).toArray(function(err, items) {
            if (typeof items != 'undefined' && !err) {
                if (items.length > 0) {
                    rep.user = items[0];
                    delete(rep.user.password);
                }
            }
            // Return results
            rep.status = 1;
            res.send(JSON.stringify(rep));
        });
    });
    router.post('/data/save', function(req, res) {
        i18nm.setLocale(req.session.current_locale);
        var rep = {
            err_fields: [],
            status: 1
        };
        // Check authorization
        if (!req.session.auth || req.session.auth.status < 2) {
            rep.status = 0;
            rep.error = i18nm.__("unauth");
            res.send(JSON.stringify(rep));
            return;
        }
        var username = req.body.username,
            password = req.body.password,
            email = req.body.email,
            realname = req.body.realname,
            status = req.body.status,
            groups = req.body.groups,
            id = req.body.id;
        if (realname) realname = realname.replace(/&/g, "").replace(/>/g, "").replace(/</g, "").replace(/"/g, "");
        if (typeof id != 'undefined' && id) {
            if (!id.match(/^[a-f0-9]{24}$/)) {
                rep.status = 0;
                rep.error = i18nm.__("invalid_query");
                res.send(JSON.stringify(rep));
                return;
            }
        }
        if (!username.match(/^[A-Za-z0-9_\-]{3,20}$/)) {
            rep.status = 0;
            rep.err_fields.push('username');
        }
        var username_auth = username.toLowerCase();
        if (!email.match(/^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/)) {
            rep.status = 0;
            rep.err_fields.push('email');
        }
        if (!realname.match(/^.{0,40}$/)) {
            rep.status = 0;
            rep.err_fields.push('realname');
        }
        if (!status.match(/^[0-2]{1}$/)) {
            rep.status = 0;
            rep.err_fields.push('status');
        }
        if (!id) {
            if (!password.match(/^.{5,20}$/)) {
                rep.status = 0;
                rep.err_fields.push('password');
                rep.err_fields.push('password-repeat');
            }
        }
        if (groups) {
            var groups_arr = groups.toLowerCase().replace(/[^a-z0-9_,]/g, "").split(',');
            var groups_arr_unique = groups_arr.filter(function(item, pos) {
                return groups_arr.indexOf(item) == pos;
            }).sort();
            groups = groups_arr_unique.join(', ');
        }
        if (rep.status === 0) {
            res.send(JSON.stringify(rep));
            return;
        }
        if (id) {
            app.get('mongodb').collection('users').find({
                $or: [{
                    username_auth: username_auth
                }, {
                    email: email
                }],
                $and: [{
                    _id: {
                        $ne: new ObjectId(id)
                    }
                }]
            }, {
                limit: 1
            }).toArray(function(err, items) {
                if (typeof items != 'undefined' && !err && items.length > 0) {
                    rep.status = 0;
                    if (items[0].username_auth == username_auth) {
                        rep.error = i18nm.__("username_exists");
                        rep.err_fields.push('username');
                    } else {
                        if (items[0].email == email) {
                            rep.error = i18nm.__("email_exists");
                            rep.err_fields.push('email');
                        }
                    }
                    res.send(JSON.stringify(rep));
                    return;
                }
                app.get('mongodb').collection('users').find({
                    _id: new ObjectId(id)
                }, {
                    limit: 1
                }).toArray(function(err, items) {
                    if (typeof items != 'undefined' && !err) {
                        if (items.length > 0) {
                            var update = {
                                username: username,
                                username_auth: username_auth,
                                email: email,
                                realname: realname,
                                status: status,
                                groups: groups
                            };
                            if (password) {
                                var md5 = crypto.createHash('md5');
                                update.password = md5.update(app.get('config').salt + '.' + password).digest('hex');
                            } else {
                                update.password = items[0].password;
                            }
                            app.get('mongodb').collection('users').update({
                                _id: new ObjectId(id)
                            }, {
                                $set: update
                            }, function() {
                                rep.status = 1;
                                res.send(JSON.stringify(rep));
                            });
                            return;
                        }
                    } else {
                        rep.status = 0;
                        rep.error = i18nm.__("id_not_found");
                        res.send(JSON.stringify(rep));
                    }
                });
            });
        } else {
            var data1 = app.get('mongodb').collection('users').find({
                $or: [{
                    username_auth: username_auth
                }, {
                    email: email
                }]
            }, {
                limit: 1
            }).toArray(function(err, items) {
                if (typeof items != 'undefined' && !err && items.length > 0) {
                    rep.status = 0;
                    if (items[0].username_auth == username_auth) {
                        rep.error = i18nm.__("username_exists");
                        rep.err_fields.push('username');
                    } else {
                        if (items[0].email == email) {
                            rep.error = i18nm.__("email_exists");
                            rep.err_fields.push('email');
                        }
                    }
                    res.send(JSON.stringify(rep));
                    return;
                }
                var md5 = crypto.createHash('md5');
                var password_md5 = md5.update(app.get('config').salt + '.' + password).digest('hex');
                app.get('mongodb').collection('users').insert({
                    username: username,
                    username_auth: username_auth,
                    email: email,
                    realname: realname,
                    status: status,
                    groups: groups,
                    password: password_md5,
                    regdate: Date.now()
                }, function() {
                    rep.status = 1;
                    res.send(JSON.stringify(rep));
                });
            });
        }
    });
    router.post('/data/delete', function(req, res) {
        i18nm.setLocale(req.session.current_locale);
        var rep = {
            status: 1
        };
        // Check authorization
        if (!req.session.auth || req.session.auth.status < 2) {
            rep.status = 0;
            rep.error = i18nm.__("unauth");
            res.send(JSON.stringify(rep));
            return;
        }
        var ids = req.body.ids;
        if (typeof ids != 'object' || ids.length < 1) {
            rep.status = 0;
            rep.error = i18nm.__("invalid_query");
            res.send(JSON.stringify(rep));
            return;
        }
        for (var i = 0; i < ids.length; i++) {
            if (ids[i].match(/^[a-f0-9]{24}$/)) {
                app.get('mongodb').collection('users').remove({
                    _id: new ObjectId(ids[i])
                }, dummy);
            }
        }
        res.send(JSON.stringify(rep));
    });

    var dummy = function() {};

    return router;
};
