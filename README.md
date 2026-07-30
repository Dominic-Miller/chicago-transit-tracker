# Open Transit Chicago

An unofficial, open-source Chicago transit tracker. Pan the map anywhere in the
city, see the train and bus departures closest to your location or map center,
open a stop's arrival board, and plot the vehicles currently running on any CTA
route without an account or subscription.

This first prototype is deliberately lightweight:

- React, TypeScript, Vite, and Leaflet in the browser
- Java 17 and Spring Boot on the server
- CTA Train Tracker and Bus Tracker for live arrivals and vehicle locations
- City of Chicago open data for stations, bus stops, and route geometry
- no database, cloud account, user account, or analytics

## Prerequisites

- Java 17+
- Maven 3.9+
- Node.js 20+
- CTA Train Tracker and Bus Tracker developer keys

## Configure the key

Copy the example environment file and add your key locally:

```bash
cp .env.example .env
```

```dotenv
CTA_API_KEY=your_key_here
CTA_BUS_API_KEY=your_bus_tracker_key_here
```

The real `.env` file is ignored by Git. The key is loaded only by Spring Boot
and is never returned to the browser.

## Run locally

In one terminal:

```bash
cd backend
mvn spring-boot:run
```

In another:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` requests to Spring Boot on port
8080.

## Test on a phone over local HTTPS

The frontend automatically enables HTTPS and listens on the local network when
development certificates exist in the ignored root `.certs` directory.

Install `mkcert`, create a local certificate authority, and generate a certificate
for the Mac's current Wi-Fi address:

```bash
brew install mkcert
mkcert -install
mkdir -p .certs
LAN_IP=$(ipconfig getifaddr en0)
mkcert -cert-file .certs/dev-cert.pem -key-file .certs/dev-key.pem \
  "$LAN_IP" localhost 127.0.0.1 ::1
cp "$(mkcert -CAROOT)/rootCA.pem" .certs/rootCA.pem
```

Then run the normal frontend development command and open
`https://<LAN_IP>:5173` on a phone connected to the same Wi-Fi network. The phone
must trust the public `rootCA.pem` certificate before browser geolocation will
work. Never copy or share `rootCA-key.pem` or `dev-key.pem`; remove the locally
installed CA from the phone after testing if it is no longer needed.

## Verify

```bash
cd backend && mvn test
cd frontend && npm test
cd frontend && npm run build
```

## Current scope

The tracker groups nearby arrival predictions by line and direction, shows an
approximate straight-line walking estimate, and adds route geometry and live train
positions when a line is selected. Location access is opt-in and coordinates are
kept only in browser memory.

The tracker supports every CTA rail and bus route. Nearby rail stations and bus
stops are combined into one departure feed, with route-specific geometry and
live vehicles loaded only after a route is selected so the map stays readable.
Bus predictions refresh once per minute and are batched across up to ten nearby
stops to stay within CTA's API guidance.

Train positions are track-circuit estimates supplied by CTA rather than onboard
GPS coordinates. Bus positions are onboard GPS reports and may temporarily
disappear when a vehicle is off-route or not communicating with Bus Tracker.

Data provided by Chicago Transit Authority and the City of Chicago. This
project is not affiliated with or endorsed by CTA.

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
