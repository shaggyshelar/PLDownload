var Nightmare = require("nightmare");
var nightmare = Nightmare({ show: false });
const filenamify = require("filenamify");
var http = require("http");
var fs = require("fs");

/*** CONFIGURATION ***/

// Link to the table of contents of the course you want
var target = "https://app.pluralsight.com/library/courses/rapid-es6-training/table-of-contents";

// Your login details
var user = {
  email: "EMAIL",
  password: "PASSWORD"
};

var delayBeetwenTwoVideos = 15000;

function LogMessage(message) {
    var datetime = new Date();
    var currentTime = message + " " + datetime.getHours() + "H " + datetime.getMinutes()+"M ";
    console.log(currentTime);
}

LogMessage("Starting download");

var numberOfFiles,  completed,  saveTo;

nightmare
  .goto("https://app.pluralsight.com/id/")
  .insert("#Username", user.email)
  .insert("#Password", user.password)
  .click("button.button.primary")
  .wait(3000)
  .goto(target)
  .wait(3000)
  .evaluate(function() {
    var courses = [];
    document
      .querySelectorAll(".table-of-contents__clip-list-item a")
      .forEach(course => {
        courses.push({
          name: course.text,
          url: course.href
        });
      });
    return {
      courses: courses.filter(thing => thing.url),
      title: document.title
    };
  })
  .then(function(module) {
    numberOfFiles = module.courses.length;
    if (!numberOfFiles) {
      console.error("Wrong login credentials!");
      process.exit(1);
      return;
    }
    LogMessage("Logged in!");
    saveTo = module.title.replace(" | Pluralsight", "");
    LogMessage(
      `Downloading "${saveTo}" from PluralSight, ${numberOfFiles} videos`
    );
    var tasks = module.courses.map((course, index) => callback => {
      scrape(course, index, callback);
    });
    require("async.parallellimit")(tasks, 1, function() {});
  })
  .catch(e => console.log(e));

function scrape(course, index, callback, delay = 1500) {
  nightmare
    .goto(course.url)
    .wait("video")
    .wait(1500)
    .evaluate(() => {
      var src = document.querySelector("video").src;
      return src;
    })
    .then(result => {
      if (!result) {
        scrape(course, index, callback, delay + 500);
        return;
      }

      course.src = result;
      saveVideo(course, index + 1, callback);
      //callback();
    })
    .catch(e => {
      console.log("Error 1", e);
      callback();
    });
}

function saveVideo(course, number, callback) {
  if (!fs.existsSync("videos/")) {
    fs.mkdirSync("videos/");
  }
  if (!fs.existsSync("videos/" + saveTo)) {
    fs.mkdirSync("videos/" + saveTo);
  }
  var validFilePath = "videos/" + saveTo + "/" + number + ". " + filenamify(course.name.replace("/", "")) + ".webm";
  if (
    fs.existsSync(validFilePath)
  ) {
    return;
  }
  setTimeout(function() {
    var file = fs.createWriteStream(validFilePath);
    var urlToDownload = course.src.replace("https", "http");
    http
      .get(urlToDownload, response => {
        response.pipe(file);
        response.on("end", () => {
          completed++;
          if (completed == numberOfFiles) {
          }
          LogMessage(validFilePath);
          callback();
        });
      })
      .on("error", e => {
        console.error(`Got error: ${e.message}`);
      });
  }, delayBeetwenTwoVideos);
}
