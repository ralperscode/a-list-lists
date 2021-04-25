const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js"); //requires dirname because it is a local file, not from npm
const mongoose = require("mongoose");
const _ = require("lodash");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const LocalStrategy = require("passport-local").Strategy
const GoogleStrategy = require("passport-google-oauth20").Strategy
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

// allow for process.env to work
require('dotenv').config();

// create app, set up view engine, body parser, and flash
const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(flash());

//setup express-session
app.use(session({
  secret:process.env.LOCAL_SECRET,
  resave: false,
  saveUninitialized: false
}));

// flash middleware that stores messages in res.locals object, which is accessable by the view engine
app.use(function(req, res, next){
  res.locals.error_message = req.flash('error_message');
  // never need to flash error or success messages but leaving this code here for reference
  // res.locals.success_message = req.flash('success_message');
  // res.locals.error = req.flash('error');
  next();
});

// initialize passport
app.use(passport.initialize());
app.use(passport.session());

// handle deprecation warning surrounding findOneAndUpdate
mongoose.set('useFindAndModify', false);

//connect to db and create todolistDB
mongoose.connect(process.env.MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });

////////////////////////MONGOOSE SCHEMA'S AND MODELS////////////////////////////

// schema and model for items for our list
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "item must have a name"]
  },
  itemDateCreated: Date, //not used, for data collection purposes
  itemDateChecked: Date, //used for checking when to delete an item
  checkedStatus: String //used for checking when to delete an item
});

const Item = new mongoose.model("Item", itemSchema);

// 3 default documents created to populate main list when empty.
// all new items are instansiated with checkedStatus = notChecked
const item1 = new Item({
  name: "Welcome to your list!",
  itemDateCreated: new Date,
  checkedStatus: "notChecked"
});
const item2 = new Item({
  name: "Add items with the form and button below.",
  itemDateCreated: new Date,
  checkedStatus: "notChecked"
});
const item3 = new Item({
  name: "Delete items by checking the checkbox.",
  itemDateCreated: new Date,
  checkedStatus: "notChecked"
});
//array for inserting these defualt items
const defaultItems = [item1, item2, item3];

// schema and model for creating new custom lists
const listSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "List must have a name"]
  },
  items: [itemSchema], // array of items that the list contains
  listDateCreated: String //used as list title for main list
});

const List = new mongoose.model("List", listSchema);

// // Defualt list for home route.
// List.findOne({name: "Today"}, function(err, foundList){
//   if (!foundList){
//     const todayList = new List({
//       name: "Today",
//       items: [],
//       listDateCreated: date.getDate() //use getDate to display date in Weekday, Month Date format
//     });
//     todayList.save();
//   }
// });

// schema and model for user
const userSchema = new mongoose.Schema({
  name: String,
  listTitles: [{type: String}],
  username: String,
  password: String,
  lists: [listSchema],
  googleId: String,
  facebookId: String
});

// add findOrCreate as plugin to userSchema for oAuth strategies
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

///////////////////PASSPORT LOCAL SETUP/////////////////////////////////////////

// local authentication strategy and session serialization
passport.use(new LocalStrategy({
  passReqToCallback: true //needed so req.flash can be used
},
  function(req, username, password, done){
    User.findOne({username: username}, function(err, user){
      if(err){
        return done(err);
      }
      if(!user){
        console.log("no user");
        // done is a passport function that returns an authenticated user
        // or false if a login mistake was made
        // use req.flash to provide res.locals with the error message
        return done(null, false, req.flash("error_message", "Username not found"));
      }
      // use bycrypt.compare() to check user entered password against hash in db
      bcrypt.compare(password, user.password, function(err, result){
        if(!result){
        console.log("password failure");
        return done(null, false, req.flash("error_message", "Invalid password"));
        }
        // if username and password matched, return the authenticated user in done()
        console.log("returning user");
        return done(null, user);
      });
    });
  }
));

// serialize session with the authenticated user's id
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

////////////////////PASSPORT oAUTH STRATEGIES///////////////////////////////////

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    callbackURL: "http://localhost:3000/auth/google/home",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo" //must add for google redirect to work
  },
  function(accessToken, refreshToken, profile, cb) {
    // create default list and a new user if they don't already exist (findOrCreate)
    const defaultList = new List({
      name: "Today",
      items: [],
      listDateCreated: date.getDate()
    });
    User.findOrCreate({ googleId: profile.id }, {lists: [defaultList]}, function (err, user) {
      return cb(err, user);
    });
}));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/home"
  },
  function(accessToken, refreshToken, profile, cb) {
    const defaultList = new List({
      name: "Today",
      items: [],
      listDateCreated: date.getDate()
    });
    User.findOrCreate({ facebookId: profile.id }, {lists:[defaultList]}, function (err, user) {
      return cb(err, user);
    });
  }
));

// ensureAuthentication middleware function for all secured routes

function ensureAuthentication(req, res, next){
  if (req.isAuthenticated()){
    next();
  } else{
    res.redirect("/login");
  }
}

///////////////////////////////ROUTES///////////////////////////////////////////

// register and login routes
app.get("/login", function(req, res){
  res.render("login");
});
// posts to login are handled by passport.authenticate using the local strategy
app.post("/login", passport.authenticate(
  "local",
  {successRedirect: "/",
  failureRedirect: "/login",
  failureFlash: true}
));

app.get("/register", function(req, res){
  res.render("register");
});

app.post("/register", function(req, res){
  // check if user already exists and flash an error if they do
  User.findOne({username: req.body.username}, function(err, foundUser){
    if(foundUser){
      req.flash("error_message", "User already exists")
      return res.redirect("/register",)
    }
    // if the user doesn't already exist, make a defualt list instance
    const defaultList = new List({
      name: "Today",
      items: [],
      listDateCreated: date.getDate()
    });
    //hash their password with bcrypt and saltRounds defined in require block
    bcrypt.hash(req.body.password, saltRounds, function(err, hash){
      // new user is created in .hash callback so we have access to the hash
      const newUser = new User({
        listTitles: [],
        username: req.body.username,
        password: hash,
        lists: [defaultList]
      });
      // save new user to database and authenticate
      newUser.save(function(){
        (User.findOne({username: req.body.username}, function(err, foundUser){
          passport.authenticate("local")(req, res, function(user){
          if(err) {return next(err);}
          // req.logIn is required because passport.authenticated was called
          // in the callback rather than using it as middleware
          req.logIn(user, function(){
            res.redirect("/");
          });
        });
        }));
      });
      });
      });
  });


// logout
app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/login");
});

// oAuth Routes

// Google
app.get("/auth/google",
  passport.authenticate('google', { scope: ['profile'] }));

// this is the route called when a user successfully logs in with google
// simply authenticates user and redirects home
app.get("/auth/google/home",
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/');
    });

// Facebook
app.get("/auth/facebook",
  passport.authenticate("facebook"));

app.get('/auth/facebook/home',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/');
    });

// App functionality routes

// home page / today / default list
app.get("/", ensureAuthentication, function(req, res){
  const currentDate = new Date(); //used in comparing when items were checked
  const currentDateString = date.getDate(); //use our getDate function to get a formated date string
  var listTitles;
  // find user by accessing the user object attached to the request by passport
  User.findById(req.user.id, function(err, foundUser){
     // get the list of their custom list titles
     listTitles = foundUser.listTitles
     // implement searching through user lists array
     // users are always created with todayList being the only list in the array. Should be at index zero
    if(foundUser.lists[0].name != "Today"){
      console.log("Error, Today is not the first list")
      res.status(404).send({success: false, error: {message: "Error fetching today list"}});
      // if first list is Today, all is well.
    } else{
      // check todayList's date created and update if necessary in order to
      // display the correct date as the list title
      if(foundUser.lists[0].listDateCreated !== currentDateString){
        foundUser.lists[0].listDateCreated = currentDateString
      }
        // make it separate constant for easier reading
        const todayList = foundUser.lists[0]
        // if there are items in the list...
        // create a payload for sending in res.render. Items is empty as we need to add to it based on checkedStatus
        const payload = {pageTitle: todayList.listDateCreated, items: [], listName: todayList.name, listTitles: listTitles}
        // loop through each item in the items array
        todayList.items.forEach(function(item){
          // check if item is checked and compare date with current date to delete
          if (item.checkedStatus === "notChecked"){
            // if item isn't checked, we need to display it so add it to the payload
            payload.items.push(item);
          }else if (item.checkedStatus === "checked"){
              // if item is checked, need to compare the date it was checked with the current date
              //bug: if user only refreshes their lists on the same day each week, items will never be deleted
              //could use getDate instead (number 1-31) but technically doesn't solve the issue. Just pushes the time scale back.
              if (item.itemDateChecked.getDay() !== currentDate.getDay()){
                // if dates don't match, delete the item
                foundUser.lists[0].items.pull(item.id);
                }else{
                // if dates were equal, than item should still be displayed. Add it to payload
                payload.items.push(item);
                }
           }
        });
        // if the list is empty after all this, populate it with the default items
        if(foundUser.lists[0].items.length === 0){
          foundUser.lists[0].items = defaultItems
          defaultItems.forEach(function(item){
            payload.items.push(item);
          });
        }
        // save changes to user and render the list template with the payload
        foundUser.save(function(err){
          res.render("list", payload);
        });
    }
  });
});

// post requests for handling new items being added
// this route handles posts from ALL LISTS since the + button is part of the
// list template and a button can only post to one route (without adding logic to list.ejs)
app.post("/", function(req, res){
  // grab list title and generate new item based on user input
  const listTitle = req.body.list; // from a hidden input whose value is the list name
  const newItem = new Item({
    name: req.body.addToList,
    itemDateCreated: new Date(),
    checkedStatus: "notChecked"
  });
    // find the User who is adding the item and push the new item onto the items array
    User.findById(req.user.id, function(err, foundUser){
        // find the right list to add the item to
        foundUser.lists.forEach(function(list){
          if(list.name === listTitle){
            list.items.push(newItem);
            foundUser.save(function(err){
              // since today list is just the "/" route, need to check what list
              // was posted to and format the redirect appropriately
              if (listTitle === "Today"){
                console.log("redirecting to home");
                res.redirect("/");
              } else{
                console.log("redirecting to named list");
                res.redirect("/" + listTitle);
              }
            });
          }
        });
  });
});

// delete route -> triggered when a checkbox is checked
app.post("/delete", function(req, res){
  //grab id of newly checked item, name of list, and create a new date
  const itemToDelete = req.body.checkboxIdTag;
  const listName = req.body.list;
  const currentDate = new Date;
  User.findById(req.user.id, function(err, foundUser){
    //find the list and loop through all items in the items array
    foundUser.lists.forEach(function(list){
      if(list.name === listName){
        list.items.forEach(function(item){
          if (item._id == itemToDelete){
            // if item was previously not checked, update it to checked and give it a date checked
            if(item.checkedStatus === "notChecked"){
              item.checkedStatus = "checked"
              item.itemDateChecked = currentDate
            // if item was previously checked, update it to notchecked and remove the date chekced
            }else if(item.checkedStatus === "checked"){
              item.checkedStatus = "notChecked"
              item.itemDateChecked = undefined
            }
          }
        });
        foundUser.save(function(err){
          if(list.name === "Today"){
            res.redirect("/");
          } else{
            res.redirect("/" + listName);
          }
        });
      }
    });
  });
});

// route for clearing all checked items from a list
app.post("/clearChecked", function(req, res){
  //grab listName and find the list
  const listName = req.body.clearCheckedBtn;
  User.findById(req.user.id, function(err, foundUser){
    if (err){
      console.log(err);
    }else{
      foundUser.lists.forEach(function(list){
        if(list.name === listName){
          // using a traditional for loop in order to preserve index integrity
          for(let i = list.items.length -1; i>=0; i--){
            // if the item is checked, pull it from the list
            if(list.items[i].checkedStatus === "checked"){
              list.items.pull(list.items[i].id);
            }
          }
          foundUser.save(function(err){
            if(listName === "Today"){
              res.redirect("/");
            }else{
              res.redirect("/" + listName);
             }
          });
         }
       });
     }
   });
 });

// routes for user created lists
app.get("/newList", ensureAuthentication, function(req, res){
    var listTitles;
    User.findById(req.user.id, function(err, foundUser){
      listTitles = foundUser.listTitles
      // console.log(listTitles);
      res.render("newList", {listTitles: listTitles, listName: "Today"});
    });
  });
// post to newList route means user is making a custom list
app.post("/newList", function(req, res){
    // grab list title and standarize capitalization
    const newListTitle = _.startCase(req.body.title);
    //find user and check if list title already exists
    User.findById(req.user.id, function(err, foundUser){
      if (foundUser.listTitles.includes(newListTitle)){
        // if it does, render error page
        res.render("error", {listTitles: foundUser.listTitles});
      }else{
        // if not, add it to the list titles array and redirect to the newly created list
        foundUser.listTitles.push(newListTitle);
        const newList = new List({
          name: newListTitle,
          items: [],
          listDateCreated: date.getDate()
        });
        foundUser.lists.push(newList);
        foundUser.save(function(err){
          res.redirect("/" + newListTitle);
        });
      }
    });
 });
// display user custom lists
app.get("/:listName", ensureAuthentication, function(req, res){
  //standardize listName's to be capital
  const listName = _.startCase(req.params.listName);
  const currentDate = new Date;
  var listTitles;
  var willRender; // used as a flag to check if user has attempted to access a list directly via URL
  // find the logged in user
  User.findById(req.user.id, function(err, foundUser){
    listTitles = foundUser.listTitles
    // find the list the user was accessing
    foundUser.lists.forEach(function(list){
      if(list.name === listName){
        // create the payload
        const payload = {pageTitle: list.name, items: [], listName: list.name, listTitles: listTitles}
        // loop through items and check their checkedStatus to determine if
        // the item should be displayed or deleted
        for(let i = list.items.length -1; i>=0; i--){
          if (list.items[i].checkedStatus === "notChecked"){
            // use unshift to add items to the front of the payload list
            // necessary because we are looping through original items backwards
            payload.items.unshift(list.items[i]);
          }else if(list.items[i].checkedStatus === "checked"){
            // compare date item was checked to current date
            if(list.items[i].itemDateChecked.getDay() !== currentDate.getDay()){
              // pull the item if it wasn't checked today
              list.items.pull(list.items[i].id);
            }else{
              // add it to payload if it was checked today
              payload.items.unshift(list.items[i]);
            }
          }
        }
        foundUser.save();
        willRender = "one" // change will render flag
        return res.render("list", payload); //why does the rest of the code execute???
        res.end();
      }
    });
    // will render flag necessary because I'm not sure why the return statment above doesn't end response
    // if we never set willRender to "one", that means the list name doesn't exist
    // user was trying to access a list that they haven't created yet, send an error
    if(!willRender){
        res.status(404).send({success: false, error: {message: "List does not exist"}});
    }
  });
});

// Routes for editing custom lists

// Rename a list
app.post("/renameList", function(req, res){
  // grab current and new list names
  const listName = req.body.renameBtn;
  const newName = _.startCase(req.body.newName);
  // find the user changing their list
  User.findById(req.user.id, function(err, foundUser){
    // find the list and update the name
    foundUser.lists.forEach(function(list){
      if (list.name === listName){
        list.name = newName
      }
    });
    // update the name in the listTitles array
    foundUser.listTitles.forEach(function(title, index){
      if(title === listName){
        // must use set because of how mongoose handles array index getters/setters
        foundUser.listTitles.set(index, newName);
      }
    });
    foundUser.save(function(err){
      res.redirect("/" + newName);
    });
  });
});

// delete a list
app.post("/deleteList", function(req, res){
  const lstToDelete = req.body.delLstBtn;
  // find the user deleting the list and delete it
  User.findById(req.user.id, function(err, foundUser){
    foundUser.lists.forEach(function(list){
      if(list.name === lstToDelete){
        foundUser.lists.pull(list);
      }
    });
    // also remove it from the listTitles array
    foundUser.listTitles.forEach(function(title){
      if(title === lstToDelete){
        foundUser.listTitles.pull(title);
      }
    });
    foundUser.save(function(err){
      res.redirect("/");
    });
  });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function(){
  console.log("Server started successfully");
});
