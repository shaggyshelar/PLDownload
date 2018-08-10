var ProgressBar = require("progress");
var Nightmare = require("nightmare");
var nightmare = Nightmare({ show: false });
const filenamify = require("filenamify");
var http = require("http");
var fs = require("fs");

/*** CONFIGURATION ***/

// Link to the table of contents of the course you want
var target =
  "https://app.pluralsight.com/library/courses/bitcoin-decentralized-technology";

var targetCourses = [
  "https://app.pluralsight.com/library/courses/bitcoin-decentralized-technology",
  "https://www.pluralsight.com/courses/premiere-pro-cc-titles",
  "https://www.pluralsight.com/courses/premiere-pro-cc-essential-graphics"
];

// Your login details
var user = {
  email: "EMAIL",
  password: "PASSWORD"
};
var delayBeetwenTwoVideos = 15000;

function LogMessage(message) {
  var datetime = new Date();
  var currentTime =
    message + " " + datetime.getHours() + "H " + datetime.getMinutes() + "M ";
  console.log(currentTime);
}

LogMessage("Initializing......");

function scrape(course, index, callback, delay = 1500) {
  var validFolderPath = filenamify(saveTo);
  var validFilePath =
    "videos/" +
    validFolderPath +
    "/" +
    (index + 1) +
    ". " +
    filenamify(course.name.replace("/", "")) +
    ".webm";
  if (fs.existsSync(validFilePath)) {
    LogMessage("File Exists: " + validFilePath);
    callback();
    return;
  }

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
        progress.interrupt("Something went wrong. Retrying...");
        scrape(course, index, callback, delay + 500);
        return;
      }

      course.src = result;
      saveVideo(course, index + 1, callback);
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
  var validFolderPath = filenamify(saveTo);
  if (!fs.existsSync("videos/" + validFolderPath)) {
    fs.mkdirSync("videos/" + validFolderPath);
  }
  var validFilePath =
    "videos/" +
    validFolderPath +
    "/" +
    number +
    ". " +
    filenamify(course.name.replace("/", "")) +
    ".webm";
  if (fs.existsSync(validFilePath)) {
    LogMessage("File Exists: " + validFilePath);
    callback();
    return;
  }
  setTimeout(function() {
    var file = fs.createWriteStream(validFilePath);
    var urlToDownload = course.src.replace("https", "http");
    var request = http
      .get(urlToDownload, response => {
        progress.tick();
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
        callback();
      });
  }, delayBeetwenTwoVideos);
}

function terminate() {
  LogMessage("Operation Completed!");
  process.exit(0);
}

function performLogin() {
  LogMessage("Logging in...");

  nightmare
  .goto("https://app.pluralsight.com/id/")
  .insert("#Username", user.email)
  .insert("#Password", user.password)
  .wait(3000)
  .click("#login")
  .wait(3000)
  .evaluate(function() {
    var prismButton = document.querySelectorAll("#prism-overflow-btn");
    if(prismButton && prismButton.length > 0) {
      return {
        isLoggedIn: true,
        length: document.querySelectorAll("#prism-overflow-btn").length
      }  
    }
    return {
      isLoggedIn: false,
      length: document.querySelectorAll("#prism-overflow-btn").length
    };
  })
  .then(function(module) {
    console.log("Module", module);
    console.log("Is Logged In", module.isLoggedIn);
    if (!module.isLoggedIn) {
      console.error("Wrong login credentials!");
      process.exit(1);
      return;
    }
    LogMessage("Logged in!");
    startDownloads();
  })
  .catch(e => console.log(e));
}

function startDownloads() {
  var tasks = targetCourses.map((course) => callback => {
    startDownloadCourse(course, callback);
  });
  require("async.parallellimit")(tasks, 1, function() {
    LogMessage("All Tasks Completed");
    process.exit(0);
  });
}

function startDownloadCourse(course, callback) {
  LogMessage("Start downloading of " + course);
  setTimeout(function(){
    LogMessage("Calling callback "+ course);
    callback();
  }, 3000);
}

function startSingleDownload(target) {
  var numberOfFiles,
  completed,
  saveTo,
  progress = 0;
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
    progress = new ProgressBar(":current/:total [:bar] :percent :etas", {
      total: numberOfFiles,
      callback: terminate
    });
    var tasks = module.courses.map((course, index) => callback => {
      scrape(course, index, callback);
    });
    require("async.parallellimit")(tasks, 1, function() {
      LogMessage("All Tasks Completed");
    });
  })
  .catch(e => console.log(e));
}

performLogin();