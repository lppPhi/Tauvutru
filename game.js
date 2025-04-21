window.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('renderCanvas');
    if (!canvas) {
        console.error("Canvas not found!");
        return;
    }
    const engine = new BABYLON.Engine(canvas, true);
    if (!engine) {
        console.error("Engine creation failed!");
        return;
    }

    // --- Game Variables ---
    let score = 0;
    let playerShip;
    const lasers = [];
    const asteroids = [];
    let lastLaserTime = 0;
    const laserCooldown = 250; // milliseconds
    let lastAsteroidSpawnTime = 0;
    const asteroidSpawnInterval = 1000; // milliseconds
    let isGameOver = false;
    const playAreaSize = 30; // Kích thước khu vực chơi giới hạn

    // UI Elements
    const scoreElement = document.getElementById('score');
    const gameOverElement = document.getElementById('gameOver');
    const finalScoreElement = document.getElementById('finalScore');

    // Input State
    const inputMap = {};

    // --- Create Scene ---
    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.02, 1); // Màu nền không gian rất tối

        // --- Camera ---
        const camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, 15, -30), scene);
        camera.setTarget(BABYLON.Vector3.Zero());

        // --- Lighting ---
        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
        const light2 = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(0, 5, -5), scene);
        light2.intensity = 0.5;

        // --- Starfield ---
        const starMaterial = new BABYLON.StandardMaterial("starMat", scene);
        starMaterial.emissiveColor = new BABYLON.Color3(0.9, 0.9, 0.9);
        starMaterial.disableLighting = true;

        for (let i = 0; i < 500; i++) {
            const star = BABYLON.MeshBuilder.CreateSphere("star" + i, {diameter: Math.random() * 0.1 + 0.05}, scene);
            const distance = 40 + Math.random() * 40;
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI - Math.PI / 2;
            star.position = new BABYLON.Vector3(
                distance * Math.cos(angle1) * Math.cos(angle2),
                distance * Math.sin(angle2),
                distance * Math.sin(angle1) * Math.cos(angle2)
            );
            star.material = starMaterial;
            star.freezeWorldMatrix();
        }

        // --- Player Ship ---
        playerShip = BABYLON.MeshBuilder.CreateCylinder("playerShip", {height: 1.5, diameterTop: 0, diameterBottom: 0.8}, scene);
        // *** QUAN TRỌNG: Xoay tàu để nó nằm ngang ***
        playerShip.rotation.x = Math.PI / 2;
        playerShip.position = new BABYLON.Vector3(0, 0, 0);

        const shipMaterial = new BABYLON.StandardMaterial("shipMat", scene);
        shipMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.8);
        shipMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.3);
        playerShip.material = shipMaterial;

        playerShip.speed = 0;
        playerShip.maxSpeed = 0.25;
        playerShip.acceleration = 0.01;
        playerShip.drag = 0.97;
        playerShip.rotationSpeed = 0.05;

        playerShip.checkCollisions = true;
        playerShip.ellipsoid = new BABYLON.Vector3(0.5, 0.5, 0.8); // Rộng X, Cao Y, Dài Z (theo trục local sau khi xoay)
        playerShip.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);


        // --- Materials for Laser & Asteroid ---
        const laserMaterial = new BABYLON.StandardMaterial("laserMat", scene);
        laserMaterial.emissiveColor = new BABYLON.Color3(1, 0.5, 0.5);
        laserMaterial.disableLighting = true;

        const asteroidMaterial = new BABYLON.StandardMaterial("asteroidMat", scene);
        asteroidMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.5, 0.4);
        asteroidMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        // --- Game Logic Functions ---

        function fireLaser() {
            const currentTime = performance.now();
            if (currentTime - lastLaserTime < laserCooldown || isGameOver) {
                return;
            }
            lastLaserTime = currentTime;

            const laser = BABYLON.MeshBuilder.CreateCylinder("laser", {height: 0.8, diameter: 0.1}, scene);
            laser.material = laserMaterial;
            laser.rotation = playerShip.rotation.clone(); // Sao chép góc quay của tàu

            // *** ĐÃ SỬA: Lấy hướng theo trục Y cục bộ ***
            const forwardVec = playerShip.getDirection(BABYLON.Axis.Y);

            // Đặt vị trí bắn ra từ mũi tàu
            laser.position = playerShip.position.add(forwardVec.scale(0.8));

            laser.speed = 0.8;
            laser.direction = forwardVec; // Lưu hướng bắn
            laser.checkCollisions = false;
            laser.isPickable = false;

            lasers.push(laser);

            setTimeout(() => {
                const index = lasers.indexOf(laser);
                if (index > -1) {
                    lasers.splice(index, 1);
                }
                if (laser && !laser.isDisposed()) { // Kiểm tra trước khi dispose
                    laser.dispose();
                }
            }, 2000);
        }

        function spawnAsteroid() {
             if (isGameOver) return;
             const currentTime = performance.now();
             if (currentTime - lastAsteroidSpawnTime < asteroidSpawnInterval) {
                 return;
             }
             lastAsteroidSpawnTime = currentTime;

             const size = Math.random() * 1.5 + 0.8;
             const asteroid = BABYLON.MeshBuilder.CreateSphere("asteroid", {diameter: size}, scene);
             asteroid.material = asteroidMaterial;

             const side = Math.floor(Math.random() * 4);
             const spawnMargin = 5;
             let x, z;
             if (side === 0) { x = Math.random() * playAreaSize * 2 - playAreaSize; z = playAreaSize + spawnMargin; }
             else if (side === 1) { x = Math.random() * playAreaSize * 2 - playAreaSize; z = -playAreaSize - spawnMargin; }
             else if (side === 2) { x = -playAreaSize - spawnMargin; z = Math.random() * playAreaSize * 2 - playAreaSize; }
             else { x = playAreaSize + spawnMargin; z = Math.random() * playAreaSize * 2 - playAreaSize; }
             asteroid.position = new BABYLON.Vector3(x, 0, z);

             const target = new BABYLON.Vector3(Math.random() * 10 - 5, 0, Math.random() * 10 - 5);
             asteroid.direction = target.subtract(asteroid.position).normalize();
             asteroid.speed = Math.random() * 0.03 + 0.02;
             asteroid.checkCollisions = true;
             asteroid.ellipsoid = new BABYLON.Vector3(size/2, size/2, size/2);
             asteroid.isPickable = false;
             asteroid.health = size;

             asteroids.push(asteroid);
         }

         function updateScore(points) {
             score += points;
             if (scoreElement) scoreElement.textContent = "Score: " + score;
         }

         function triggerGameOver() {
             if (isGameOver) return;
             isGameOver = true;
             console.log("GAME OVER");
             if (gameOverElement) {
                 finalScoreElement.textContent = score;
                 gameOverElement.classList.remove('hidden');
             }
             playerShip.speed = 0; // Dừng tàu
         }

        // --- Input Handling ---
        scene.actionManager = new BABYLON.ActionManager(scene);
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, function (evt) {
            inputMap[evt.sourceEvent.key.toLowerCase()] = true;
        }));
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, function (evt) {
            inputMap[evt.sourceEvent.key.toLowerCase()] = false;
        }));

        // --- Game Loop (Before Render) ---
        scene.registerBeforeRender(function() {
            if (isGameOver) return;

            const deltaTime = engine.getDeltaTime() / 1000.0;

            // Player Input & Movement
            if (inputMap["a"]) { // Rotate Left (Quay quanh trục Y thế giới)
                playerShip.rotation.y -= playerShip.rotationSpeed;
            }
            if (inputMap["d"]) { // Rotate Right (Quay quanh trục Y thế giới)
                playerShip.rotation.y += playerShip.rotationSpeed;
            }
            if (inputMap["w"]) { // Accelerate
                playerShip.speed += playerShip.acceleration;
                if (playerShip.speed > playerShip.maxSpeed) {
                    playerShip.speed = playerShip.maxSpeed;
                }
            }
            if (inputMap[" "]) { // Fire
                fireLaser();
            }

            // Apply drag and move ship
            playerShip.speed *= playerShip.drag;

            // *** ĐÃ SỬA: Lấy hướng theo trục Y cục bộ ***
            const forward = playerShip.getDirection(BABYLON.Axis.Y);
            playerShip.position.addInPlace(forward.scale(playerShip.speed));

            // Keep player within bounds (Wrap Around)
            if (playerShip.position.x > playAreaSize) playerShip.position.x = -playAreaSize;
            if (playerShip.position.x < -playAreaSize) playerShip.position.x = playAreaSize;
            if (playerShip.position.z > playAreaSize) playerShip.position.z = -playAreaSize;
            if (playerShip.position.z < -playAreaSize) playerShip.position.z = playAreaSize;
            playerShip.position.y = 0; // Giữ tàu trên mặt phẳng XZ

            // Move Lasers
            for (let i = lasers.length - 1; i >= 0; i--) {
                const laser = lasers[i];
                if (laser.isDisposed()) { // Bỏ qua nếu đạn đã bị hủy bởi timeout
                     lasers.splice(i, 1);
                     continue;
                 }
                laser.position.addInPlace(laser.direction.scale(laser.speed));

                // Check Laser-Asteroid Collision
                for (let j = asteroids.length - 1; j >= 0; j--) {
                    const asteroid = asteroids[j];
                    if (laser.intersectsMesh(asteroid, false)) {
                        asteroid.health -= 1;
                        if (!laser.isDisposed()){ // Kiểm tra trước khi dispose
                             laser.dispose();
                        }
                        lasers.splice(i, 1);

                        if (asteroid.health <= 0) {
                            updateScore(Math.ceil(asteroid.ellipsoid.x * 10));
                            if (!asteroid.isDisposed()){ // Kiểm tra trước khi dispose
                                asteroid.dispose();
                            }
                            asteroids.splice(j, 1);
                        }
                        break; // Thoát vòng lặp thiên thạch
                    }
                }
            }

            // Move Asteroids & Check Player Collision
            for (let i = asteroids.length - 1; i >= 0; i--) {
                const asteroid = asteroids[i];
                if (asteroid.isDisposed()){ // Bỏ qua nếu thiên thạch đã bị hủy
                     asteroids.splice(i, 1);
                     continue;
                 }
                asteroid.position.addInPlace(asteroid.direction.scale(asteroid.speed));

                 if (Math.abs(asteroid.position.x) > playAreaSize + 10 || Math.abs(asteroid.position.z) > playAreaSize + 10) {
                     asteroid.dispose();
                     asteroids.splice(i, 1);
                     continue;
                 }

                if (playerShip.intersectsMesh(asteroid, false)) {
                     triggerGameOver();
                     break; // Thoát vòng lặp vì đã thua
                 }
            }

            spawnAsteroid();

        }); // End of registerBeforeRender

        return scene;
    }; // End of createScene

    // --- Start the game ---
    const scene = createScene();

    if (scene) {
        engine.runRenderLoop(function() {
            scene.render();
        });

        window.addEventListener('resize', function() {
            engine.resize();
        });
    } else {
        console.error("Scene creation failed, cannot start game loop.");
    }
}); // End of DOMContentLoaded listener