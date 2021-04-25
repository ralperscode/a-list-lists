// grab all buttons that are visible when rename or delete windows are open
const btnsToTurnOff = document.querySelectorAll(".turnOff");

// turn buttons back on after window closes
function buttonsOn(){
  btnsToTurnOff.forEach(function(btn){
    btn.disabled = false
  });
}

// function for adding ability to close rename or delete windows
// by clicking anywhere on the page
function windowListener(){
  console.log("adding window listener");
  const body = document.querySelector("body");
  if (event.target == body){
    if(delForm.style.display == "flex"){
        closeDelete();
        window.removeEventListener("click", windowListener);
        return
      }else if(renameForm.style.display == "flex"){
        closeRename();
        window.removeEventListener("click", windowListener);
        return
      }
  }
}

// add click event listener to edit list buttons that turns off all other buttons
document.querySelectorAll(".editLstBtn").forEach(function(btn){
  btn.addEventListener("click", function(){
    btnsToTurnOff.forEach(function(otherBtn){
      otherBtn.disabled = true;
    });
    if(btnsToTurnOff[0].disabled == true){
      window.addEventListener("click", windowListener);
    }
  });
});

// open rename div and blur the rest
function openRename() {
  const form = document.getElementById("renameForm");
    form.style.display = "flex";
    const divs = document.querySelectorAll("div");
    divs.forEach(function(div){
      div.classList.toggle("blur");
    });
    form.classList.toggle("blur");
  }

// close rename div, unblur other divs, and turn buttons back on
function closeRename() {
  document.getElementById("renameForm").style.display = "none";
  const divs = document.querySelectorAll("div");
  divs.forEach(function(div){
    div.classList.toggle("blur");
  });
  document.getElementById("renameForm").classList.toggle("blur");
  buttonsOn();
}

// same two functions, except for delete div
function openDelete() {
  const form = document.getElementById("delForm");
    form.style.display = "flex";
    const divs = document.querySelectorAll("div");
    divs.forEach(function(div){
      div.classList.toggle("blur");
    });
    form.classList.toggle("blur");
  }

function closeDelete() {
  document.getElementById("delForm").style.display = "none";
  const divs = document.querySelectorAll("div");
  divs.forEach(function(div){
    div.classList.toggle("blur");
  });
  document.getElementById("delForm").classList.toggle("blur");
  buttonsOn();
}
