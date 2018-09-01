const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const crypto = require("crypto");
const fse = require("fs-extra");
const path = require("path");

const config = require("./config");
const logger = require("./logger");
const {
  pm2Start,
  pm2Stop,
  removePackageLock,
  performPull,
  performNpmInstall,
  performNpmPrune,
  runPostInit
} = require("./utils");

const app = express();
app.set("trust proxy", "127.0.0.1");
app.use(morgan("combined", { stream: logger.stream }));
app.use(bodyParser.json());

let promise = Promise.resolve();

app.post("/", (req, res) => {
  const secret = req.header("x-hub-signature");
  if (!secret) {
    res.status(403).send("Denied: Unauthorized");
    logger.warn("Access denied: secret key was not provided");
    return;
  }
  const hash = `sha1=${crypto
    .createHmac("sha1", config.githubSecret)
    .update(JSON.stringify(req.body))
    .digest("hex")}`;
  if (secret !== hash) {
    res.status(403).send("Denied: Unauthorized");
    logger.warn("Access denied: secret key did not match");
    return;
  }
  const repoName = req.body.repository.full_name;
  const projects =
    fse.readJsonSync(path.join(__dirname, config.appListFileName)) || [];
  const project = projects.find(p => p.githubName === repoName);
  if (!repoName || !project) {
    res.status(404).send("Unknown repository");
    logger.warn(`Unknown repository requested: ${repoName}`);
    return;
  }
  logger.info(`Updating project "${project.name}"`);
  promise = promise.then(() =>
    pm2Stop(project.name)
      .then(() => {
        logger.info("Removing package-lock...");
        return removePackageLock(project.directory);
      })
      .then(() => {
        logger.info(`Stopped application ${project.name}`);
        return performPull(project.directory);
      })
      .then(() => {
        logger.info("git pull successfull!");
        return performNpmInstall(project.directory);
      })
      .then(() => {
        logger.info("npm install successfull!");
        return performNpmPrune(project.directory);
      })
      .then(() => {
        logger.info("npm prune successfull!");
        return runPostInit(project.directory).catch(() => {
          logger.warn("No postinit script specified!");
          return Promise.resolve();
        });
      })
      .then(() => {
        logger.info(`Starting ${project.name}`);
        return pm2Start(project.name);
      })
      .then(() => {
        logger.info("All done!");
      })
      .catch(err => {
        logger.error(`Error! ${err.message}`);
        return pm2Start(project.name);
      })
  );
  res.status(200).send();
});

app.listen(config.port, () => {
  logger.info(`Deployer app listening on port ${config.port}!`);
});
