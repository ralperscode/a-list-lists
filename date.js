//export our getDate function in the form of a module that can be required in app.js

module.exports.getDate = getDate //exports the function. no () because that would run it

//modules are JS objects. making .getDate = getDate, it is now a method of the module when exported
//this allows us to add and export more functions, things, if we wanted to

function getDate() {
  let today = new Date();
  let options = {
    weekday: "long",
    day: "numeric",
    month: "long"
  }
  let day = today.toLocaleDateString("en-US", options);

  return day;
}
