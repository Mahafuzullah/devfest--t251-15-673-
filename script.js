let data = null;
let blockedNodes = new Set(), closedExits = new Set();
let currentRoute = [], currentCost = 0;
let lang = 'en';

const text = {
        en: { title: "Smart Escape Simulator", start: "Start Node:", reset: "Reset Hazards", status: "Status:", route: "Route:", cost: "Total Cost:", help: "Click nodes on the map to block/unblock them or close exits.", ready: "Ready", noRoute: "No route available", startBlocked: "Starting location blocked" },
        bn: { title: "স্মার্ট এস্কেপ সিমুলেটর", start: "শুরুর নোড:", reset: "রিসেট করুন", status: "স্ট্যাটাস:", route: "রুট:", cost: "মোট খরচ:", help: "ব্লক/আনব্লক বা বন্ধ করতে ম্যাপের নোডে ক্লিক করুন।", ready: "প্রস্তুত", noRoute: "কোন রুট নেই", startBlocked: "শুরুর স্থান ব্লক করা আছে" }
};

window.onload = async () => {
        const res = await fetch('building.json');
        data = await res.json();
        populateSelect();
        resetState();

        document.getElementById('map').addEventListener('click', (e) => {
                const rect = e.target.getBoundingClientRect();
                const x = e.clientX - rect.left, y = e.clientY - rect.top;
                data.nodes.forEach(n => {
                        if (Math.hypot(n.x - x, n.y - y) < 20) {
                                if (n.type === 'exit') {
                                        closedExits.has(n.id) ? closedExits.delete(n.id) : closedExits.add(n.id);
                                } else {
                                        blockedNodes.has(n.id) ? blockedNodes.delete(n.id) : blockedNodes.add(n.id);
                                }
                                calculateRoute();
                        }
                });
        });
};

function populateSelect() {
        const sel = document.getElementById('start-node');
        data.nodes.filter(n => n.type !== 'exit').forEach(n => {
                sel.innerHTML += `<option value="${n.id}">${n.id} (${n.label})</option>`;
        });
}

function resetState() {
        blockedNodes.clear(); closedExits.clear();
        data.initial_state.blocked_nodes.forEach(n => blockedNodes.add(n));
        data.initial_state.closed_exits.forEach(n => closedExits.add(n));
        calculateRoute();
}

function toggleLang() {
        lang = lang === 'en' ? 'bn' : 'en';
        document.getElementById('title').innerText = text[lang].title;
        document.getElementById('start-label').innerText = text[lang].start;
        document.getElementById('reset-btn').innerText = text[lang].reset;
        document.getElementById('help-text').innerText = text[lang].help;
        calculateRoute();
}

function calculateRoute() {
        const start = document.getElementById('start-node').value;
        currentRoute = []; currentCost = 0;

        if (!start) { updateUI(text[lang].ready, "None", 0); draw(); return; }
        if (blockedNodes.has(start)) { updateUI(text[lang].startBlocked, "None", 0); draw(); return; }

        let distances = {}, prev = {};
        let pq = data.nodes.map(n => n.id);
        pq.forEach(id => distances[id] = Infinity);
        distances[start] = 0;

        while (pq.length) {
                pq.sort((a, b) => distances[a] - distances[b]);
                let curr = pq.shift();
                if (distances[curr] === Infinity) break;

                let edges = data.edges.filter(e => e.from === curr || e.to === curr);
                edges.forEach(e => {
                        let neighbor = e.from === curr ? e.to : e.from;
                        if (blockedNodes.has(neighbor)) return;
                        let alt = distances[curr] + e.cost;
                        if (alt < distances[neighbor]) {
                                distances[neighbor] = alt;
                                prev[neighbor] = curr;
                        }
                });
        }

        let validExits = data.nodes.filter(n => n.type === 'exit' && !closedExits.has(n.id) && distances[n.id] !== Infinity);
        if (!validExits.length) { updateUI(text[lang].noRoute, "None", 0); draw(); return; }

        validExits.sort((a, b) => distances[a.id] - distances[b.id] || a.id.localeCompare(b.id));
        let target = validExits[0].id;

        let path = [];
        for (let at = target; at; at = prev[at]) path.push(at);
        currentRoute = path.reverse();
        currentCost = distances[target];

        updateUI("Route Found", currentRoute.join(" → "), currentCost);
        draw();
}

function updateUI(status, route, cost) {
        document.getElementById('status-text').innerText = `${text[lang].status} ${status}`;
        document.getElementById('route-text').innerText = `${text[lang].route} ${route}`;
        document.getElementById('cost-text').innerText = `${text[lang].cost} ${cost}`;
}

function draw() {
        const ctx = document.getElementById('map').getContext('2d');
        ctx.clearRect(0, 0, 800, 400);

        data.edges.forEach(e => {
                let n1 = data.nodes.find(n => n.id === e.from);
                let n2 = data.nodes.find(n => n.id === e.to);
                let inRoute = false;
                for (let i = 0; i < currentRoute.length - 1; i++) {
                        if ((currentRoute[i] === e.from && currentRoute[i + 1] === e.to) || (currentRoute[i] === e.to && currentRoute[i + 1] === e.from)) inRoute = true;
                }
                ctx.beginPath();
                ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
                ctx.strokeStyle = inRoute ? "#0056b3" : "#ccc";
                ctx.lineWidth = inRoute ? 4 : 2;
                ctx.stroke();

                ctx.fillStyle = "#666"; ctx.font = "14px Arial";
                ctx.fillText(e.cost, (n1.x + n2.x) / 2, (n1.y + n2.y) / 2 - 5);
        });

        data.nodes.forEach(n => {
                ctx.beginPath();
                ctx.arc(n.x, n.y, 20, 0, 2 * Math.PI);
                let color = n.type === 'exit' ? '#28a745' : '#007bff';
                if (n.type === 'exit' && closedExits.has(n.id)) color = '#dc3545';
                if (n.type !== 'exit' && blockedNodes.has(n.id)) color = '#dc3545';
                ctx.fillStyle = color;
                ctx.fill();
                ctx.fillStyle = 'white'; ctx.font = "12px Arial"; ctx.textAlign = "center";
                ctx.fillText(n.id, n.x, n.y + 4);
        });
}