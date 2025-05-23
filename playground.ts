async function timer1() {
    const startTime = Date.now();
    while (startTime + 1000 > Date.now()) {
        console.log("timer1");
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("timer1 done");
    }
}

async function timer2() {
    const startTime = Date.now();
    while (startTime + 1000 > Date.now()) {
        console.log("timer2");
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("timer2 done");
    }
}

await Promise.all([timer1(), timer2()]);
