// get the daner span and format it's html. It was comming back from flash with enters and spaces
// replace and the regEx handles the enters. Trim handls the spaces
var danger_span = document.querySelector(".alert-danger").innerHTML.replace(/\s+/g, ' ').trim();

// if there is a non empty string in the span, send an alert with it's contents
if(danger_span != ""){
  console.log("error occured loging in");
  alert(danger_span);
}
