const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const crypto = require("crypto");
const fse = require("fs-extra");
const path = require("path");

const config = require("./config");
const {
  pm2Start,
  pm2Stop,
  performPull,
  performNpmInstall,
  performNpmPrune,
  runPostInit
} = require("./utils");

const app = express();
app.set("trust proxy", "127.0.0.1");
app.use(morgan("combined"));
app.use(bodyParser.json());

let promise = Promise.resolve();

app.post("/", (req, res) => {
  const secret = req.header("x-hub-signature");
  if (!secret) {
    res.status(403).send("Denied: Unauthorized");
    console.log("Access denied: secret key was not provided");
    return;
  }
  const hash = `sha1=${crypto
    .createHmac("sha1", config.githubSecret)
    .update(JSON.stringify(req.body))
    .digest("hex")}`;
  if (secret !== hash) {
    res.status(403).send("Denied: Unauthorized");
    console.log("Access denied: secret key did not match", secret, hash);
    return;
  }
  const repoName = req.body.repository.full_name;
  const projects =
    fse.readJsonSync(path.join(__dirname, config.appListFileName)) || [];
  const project = projects.find(p => p.githubName === repoName);
  if (!repoName || !project) {
    res.status(404).send("Unknown repositoy");
    console.log(`Unknown repository requested: ${repoName}`);
    return;
  }
  promise = promise.then(() =>
    pm2Stop(project.name)
      .then(() => {
        console.log(`Stopped application ${project.name}`);
        return performPull(project.directory);
      })
      .then(() => {
        console.log("git pull successfull!");
        return performNpmInstall(project.directory);
      })
      .then(() => {
        console.log("npm install successfull!");
        return performNpmPrune(project.directory);
      })
      .then(() => {
        console.log("npm prune successfull!");
        return runPostInit(project.directory);
      })
      .then(() => {
        console.log(`Starting ${project.name}`);
        return pm2Start(project.name);
      })
      .then(() => {
        console.log("All done!");
      })
      .catch(err => {
        console.log(err);
        return pm2Start(project.name);
      })
  );
  res.status(200).send();
});

app.listen(config.port, () => {
  console.log(`Deployer app listening on port ${config.port}!`);
});
