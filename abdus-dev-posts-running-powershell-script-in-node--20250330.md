Title: Running a Powershell script in Node

URL Source: https://abdus.dev/posts/running-powershell-script-in-node/

Markdown Content:
I needed a way to call a Powershell script from Node. Node provides `child_process` module, which provides tools to execute and communicate with external processes.

We're going to use `spawn` for this. It allows us to pipe the `stdout`/`stderr` of a process back to caller. This helps the caller to see what the process is actually doing behind the scenes.

```
const {spawn} = require("child_process");

/**
 * @param {string} executable
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} opts
 * @return {Promise<number>} return code
 * */
async function run(executable, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, {
            shell: true,
            stdio: ["pipe", process.stdout, process.stderr],
            ...opts,
        });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve(code);
            } else {
                const e = new Error('Process exited with error code ' + code);
                e.code = code;
                reject(e);
            }
        });
    });
}
```

I like writing my own wrapper to promisify `spawn`. It helps me return the exit code to the caller and I also get a better intellisense while writing scripts.

We can call `run` inside a try-catch block to capture errors and set a correct exit code.

```
try {
    const code = await run('powershell', ["-executionpolicy", "unrestricted", "-file", 'script.ps1']);
    process.exit(code);
} catch (e) {
    console.error(e);
    process.exit(e.code || 1);
}
```
