const shell = require("shelljs");
const path = require("path");

const config = require("./config");

const { reposDir } = config;
const postInitScript = "deployerPostInit";
const sudoPrefix = "sudo -u www-data -H";

const exec = (...args) =>
  new Promise((resolve, reject) => {
    shell.exec(...args, (code, stdout, stderr) => {
      if (!code) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command '${args[0]}' failed with code ${code}`));
      }
    });
  });

const pm2Start = name => exec(`pm2 start ${name}`);
const pm2Stop = name => exec(`pm2 stop ${name}`);
const pm2StartAsApache = (name, file, port) =>
  exec(
    `sudo -u www-data -H PM2_HOME='/home/www-data/.pm2' PORT=${port} pm2 start "${file}" --name "${name}"`
  );
const pm2SaveAsApache = () =>
  exec(`${sudoPrefix} PM2_HOME='/home/www-data/.pm2' pm2 save`);

const removePackageLock = projectDir =>
  exec(`rm "${path.join(reposDir, projectDir, "package-lock.json")}"`);

const performPull = projectDir =>
  exec(`git -C "${reposDir + projectDir}" pull origin master`);
const performNpmInstall = projectDir =>
  exec(
    `npm --prefix "${reposDir + projectDir}" install "${reposDir +
      projectDir}" --production`
  );
const performNpmPrune = projectDir =>
  exec(
    `npm --prefix "${reposDir + projectDir}" prune "${reposDir +
      projectDir}" --production`
  );
const runPostInit = projectDir =>
  exec(`npm --prefix "${reposDir + projectDir}" run "${postInitScript}"`);

const chownApache = projectDir =>
  exec(`chown -R www-data:www-data "${reposDir + projectDir}"`);
const sudoInitGit = (projectDir, githubName) =>
  exec(`${sudoPrefix} git -C "${reposDir + projectDir}" init`).then(() =>
    exec(
      `${sudoPrefix} git -C "${reposDir +
        projectDir}" remote add origin git@github.com:${githubName}`
    )
  );
const performSudoPull = projectDir =>
  exec(`${sudoPrefix} git -C "${reposDir + projectDir}" pull origin master`);
const performSudoNpmInstall = projectDir =>
  exec(
    `${sudoPrefix} npm --prefix "${reposDir + projectDir}" install "${reposDir +
      projectDir}" --production`
  );
const runSudoPostInit = projectDir =>
  exec(
    `${sudoPrefix} npm --prefix "${reposDir +
      projectDir}" run "${postInitScript}"`
  );

module.exports = {
  exec,
  pm2Start,
  pm2Stop,
  pm2StartAsApache,
  pm2SaveAsApache,
  removePackageLock,
  performPull,
  performNpmInstall,
  performNpmPrune,
  runPostInit,
  chownApache,
  sudoInitGit,
  performSudoPull,
  performSudoNpmInstall,
  runSudoPostInit
};
