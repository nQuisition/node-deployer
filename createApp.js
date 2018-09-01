const readline = require("readline");
const fse = require("fs-extra");
const path = require("path");

const config = require("./config");
const logger = require("./logger");
const {
  pm2StartAsApache,
  pm2SaveAsApache,
  chownApache,
  sudoInitGit,
  performSudoPull,
  performSudoNpmInstall,
  runSudoPostInit
} = require("./utils");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = query =>
  new Promise(resolve => {
    rl.question(query, answer => resolve(answer));
  });

const appProps = {};
const defaultEntryScript = "app.js";

question("Name of your application: ")
  .then(res => {
    appProps.name = res;
    return question("Github repo name (without .git extension): ");
  })
  .then(res => {
    appProps.githubName = res;
    return question(`Application directory (${appProps.name}): `);
  })
  .then(res => {
    appProps.directory = res && res !== "" ? res : appProps.name;
    return question(`Application entry point (${defaultEntryScript}): `);
  })
  .then(res => {
    appProps.entryScript = res && res !== "" ? res : defaultEntryScript;
    return fse
      .readJson(path.join(__dirname, config.appListFileName))
      .catch(() => Promise.resolve([]));
  })
  .then(json => {
    if (json && json.find(app => app.name === appProps.name)) {
      throw new Error("An app with this name already exists!");
    }
    const lastPort = json.reduce(
      (port, app) => (app.port && app.port > port ? app.port : port),
      config.port
    );
    appProps.port = lastPort + 1;
    json.push(appProps);
    return fse.writeJson(path.join(__dirname, config.appListFileName), json);
  })
  .then(() => {
    const directory = path.join(config.reposDir, appProps.directory);
    if (!fse.existsSync(directory)) {
      fse.mkdirSync(directory);
    }
    // TODO needed?
    fse.emptyDirSync(directory);
    return chownApache(appProps.directory);
  })
  .then(() => {
    logger.info("Performing git init...");
    return sudoInitGit(appProps.directory, `${appProps.githubName}.git`);
  })
  .then(() => {
    logger.info("Performing git pull...");
    return performSudoPull(appProps.directory);
  })
  .then(() => {
    logger.info("Performing npm install...");
    return performSudoNpmInstall(appProps.directory);
  })
  .then(() => {
    logger.info("Performing postinit");
    return runSudoPostInit(appProps.directory).catch(() => {
      logger.warn("No postinit script specified!");
      return Promise.resolve();
    });
  })
  .then(() => {
    logger.info("Registering with pm2...");
    return pm2StartAsApache(
      appProps.name,
      path.join(config.reposDir, appProps.directory, appProps.entryScript),
      appProps.port
    );
  })
  .then(() => pm2SaveAsApache())
  .then(() => {
    logger.info("App successfully created!");
    rl.close();
  })
  .catch(err => {
    logger.error(`Error! ${err.message}`);
    rl.close();
  });
