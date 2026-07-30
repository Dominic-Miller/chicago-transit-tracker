# Open Transit Chicago

An unofficial, open-source Chicago transit tracker. Pan the map anywhere in the
city, see the lines and departures closest to your location or map center, open
an 'L' station's arrival board, and plot the trains currently running on any rail
route without an account or subscription.

This first prototype is deliberately lightweight:

- React, TypeScript, Vite, and Leaflet in the browser
- Java 17 and Spring Boot on the server
- CTA Train Tracker for live arrivals and route-level train locations
- City of Chicago open data for station locations
- no database, cloud account, user account, or analytics

## Prerequisites

- Java 17+
- Maven 3.9+
- Node.js 20+
- A CTA Train Tracker developer key

## Configure the key

Copy the example environment file and add your key locally:

```bash
cp .env.example .env
```

```dotenv
CTA_API_KEY=your_key_here
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

The prototype tracks CTA rail stations, arrival predictions, and train locations.
Train positions are track-circuit estimates supplied by CTA rather than onboard
GPS coordinates. Bus tracking will be added through the Bus Tracker API or
GTFS-Realtime after that access is available.

Data provided by Chicago Transit Authority and the City of Chicago. This
project is not affiliated with or endorsed by CTA.

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
