const carCanvas = document.getElementById("carCanvas");
carCanvas.width = 200;
const networkCanvas = document.getElementById("networkCanvas");
networkCanvas.width = 700;

const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d")
const road = new Road(carCanvas.width / 2, carCanvas.width * 0.9)


const N = 110;
const cars = generateCars(N);
let bestCarIndex = 0;
let bestCar = cars[bestCarIndex];
let scrollY = 0;


const traffic = [
    new Car(road.getLaneCenter(1), -100, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(0), -300, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(2), -300, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(1), -400, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(2), -600, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(1), -700, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(2), -800, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(0), -800, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(0), -500, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(1), -900, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(2), -1000, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(0), -1000, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(1), -1100, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(2), -1200, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(0), -1200, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(1), -1300, 30, 50, "DUMMY", 1),
    new Car(road.getLaneCenter(2), -1300, 30, 50, "DUMMY", 1),
];
animate();

function getMutationRateFromDistance(carY, finishY) {
    const maxDistance = 1500; // adjust if your road is longer
    const distance = Math.max(0, carY - finishY); // bigger = worse

    const normalized = Math.min(1, distance / maxDistance);
    const mutationRate = 0.005 + normalized * (0.2 - 0.005); // from 0.01 to 0.4

    return mutationRate;
}


function generateCars(N) {
    const cars = [];
    const bestBrains = JSON.parse(localStorage.getItem("BestBrains") || "[]");

    if (bestBrains.length === 0 ) {
        // No saved brains yet — generate pure random ones
        for (let i = 0; i < N; i++) {
            const car = new Car(road.getLaneCenter(1), 100, 30, 50, "AI");
            car.brain = new NeuralNetwork([car.sensor.rayCount, 8, 4]);
            car.mutationTag = "random";
            cars.push(car);
        }
    } else {
        // Use up to 10 best brains
        const brainsToUse = bestBrains.slice(0, 10);
        // 1 exact copy of each best brain
        for (let i = 0; i < 10; i++) {
            const car = new Car(road.getLaneCenter(1), 100, 30, 50, "AI");
            car.brain = JSON.parse(JSON.stringify(brainsToUse[i].brain));
            car.mutationTag = "none";
            cars.push(car);
        }

        // 10 mutations per best brain
        const finishY = road.FINISH_Y

        for (let i = 0; i < brainsToUse.length; i++) {
            const brainData = brainsToUse[i];
            const carY = 1000 - brainData.score; // estimate car y based on score if needed
            const mutationRate = getMutationRateFromDistance(carY, finishY);

            const numMutations = Math.floor((N - 10) / brainsToUse.length);

            for (let j = 0; j < numMutations; j++) {
                const car = new Car(road.getLaneCenter(1), 100, 30, 50, "AI");
                car.brain = JSON.parse(JSON.stringify(brainData.brain));
                NeuralNetwork.mutate(car.brain, mutationRate);
                car.mutationTag = mutationRate > 0.1 ? "strong" : "mild";
                cars.push(car);
            }
        }

    }

    return cars;
}


function score(car) {
    const targetY = traffic[traffic.length - 1].y;
    const distance = targetY - car.y;

    let reward = distance;

    // Overtake bonus only once per traffic car
    for (let i = 0; i < traffic.length; i++) {
        const t = traffic[i];
        if (car.y < t.y && !car.passedTraffic.has(i)) {
            reward += 500; // reward for passing
            car.passedTraffic.add(i); // mark as passed
        }
    }

    // Bonus for reaching finish line
    if (car.y < targetY) {
        reward += 10000;
    }

    car.score = reward;
}

function sessionBestBrain(){
    const brainpool = JSON.parse(localStorage.getItem("BestBrains") || "[]");
    const sesionBests = JSON.parse(localStorage.getItem("SessionBestBrains") || "[]");

    const bestBrain = brainpool[0].brain
    sesionBests.push({brain : bestBrain})

    localStorage.setItem("SessionBestBrains" , JSON.stringify(sesionBests))

    localStorage.removeItem('BestBrains'); location.reload()

}




// Save up to 10 best brains
function saveBestBrains() {

    let brainPool = JSON.parse(localStorage.getItem("BestBrains") || "[]");

    // Filter out cars that are marked for removal and sort the remaining cars by score
    const sortedCars = cars.filter(car => car.removeMe).sort((a, b) => b.score - a.score);

    // Log to check the sorted cars
    console.log("Sorted Cars based on score:", sortedCars.map(car => car.score));

    // If we have cars left to save, add the top 10 cars
    if (sortedCars.length > 0) {
        sortedCars.slice(0, 10).forEach(car => {
            brainPool.push({ brain: car.brain, score: car.score });
        });

        // Sort the pool by score and keep the top 10
        brainPool.sort((a, b) => b.score - a.score);
        brainPool = brainPool.slice(0, 10);

        console.log("Brain Pool before saving:", brainPool);
        localStorage.setItem("BestBrains", JSON.stringify(brainPool));

        console.log("🧠 Saving best brains for the next iteration.");
        console.table(brainPool.map(b => b.score));
    } else {
        console.log("No cars left to save. Check why cars are being removed too early.");
    }
}

function animate(time) {

    // Update traffic
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].update(road.borders, []);
    }

    // Update cars
    for (let i = 0; i < cars.length; i++) {
        cars[i].update(road.borders, traffic);
    }






    // Check if cars have crossed the finish line
    for (let car of cars) {
        if (car.y < road.FINISH_Y) {
                console.log("🏁 First car reached the finish line and got rewarded!");
            car.removeMe = true;
        }
    }

    // Update canvas sizes and drawing
    carCanvas.height = window.innerHeight;
    networkCanvas.height = window.innerHeight;

    carCtx.save();

    // Track the car with the lowest `y`
    bestCar = cars.reduce((best, car) => car.y < best.y ? car : best, cars[0]);

    scrollY -= 2.5; // change the speed here, 2 pixels per frame
    carCtx.translate(0, -scrollY + carCanvas.height * 0.7);


    for (let i = 0; i < cars.length; i++) {
        if (!cars[i].removeMe) {
            // Get distance from best car
            const lag = cars[i].y - bestCar.y;

            if (
                cars[i].damaged ||
                cars[i].removed ||
                cars[i].y > scrollY + carCanvas.height - 50 ||
                lag > 400 // ← Add this! if a car lags behind the bestCar by >400
            ) {
                cars[i].removeMe = true;
                cars[i].removed = true;
            }
        }
    }


    road.draw(carCtx);
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].draw(carCtx, "red");
    }

    carCtx.globalAlpha = 0.2;
    for (let i = 0; i < cars.length; i++) {
        if (!cars[i].removeMe) {
            let color = "blue";

            switch (cars[i].mutationTag) {
                case "none":
                    color = "yellow"; // exact brain
                    break;
                case "mild":
                    color = "Blue";
                    break;
                case "strong":
                    color = "orange";
                    break;
                case "random":
                    color = "gray";
                    break;
            }

            cars[i].draw(carCtx, color);
        }
    }



    carCtx.globalAlpha = 1;
    carCtx.restore();

    // If all cars are removed, save the best brains and restart
    if (cars.every(car => car.removeMe)) {
        console.log("💾 Saving best brains after full round.");

        for (let car of cars) {
            score(car); // This is crucial!
        }

        saveBestBrains();

        setTimeout(() => {
            location.reload(); // Restart the simulation
        }, 100);
        return;
    }

    Visualizer.drawNetwork(networkCtx, bestCar ? bestCar.brain : null);
    requestAnimationFrame(animate);
}
