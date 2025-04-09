const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

exports.pullEventbriteEvents = functions
  .region("us-west1")
  .https.onRequest(async (req, res) => {
    const token = functions.config().eventbrite.token;
    const city = "Los Angeles";

    const url = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(
      city
    )}&price=free&expand=venue`;

    console.log(`🌐 Starting Eventbrite fetch`);
    console.log(`🔗 URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log(`📥 Eventbrite response status: ${response.status}`);

      const data = await response.json();

      if (!data.events || data.events.length === 0) {
        console.log("⚠️ No events returned from Eventbrite.");
        res.status(200).send("No events found.");
        return;
      }

      console.log(`📝 Found ${data.events.length} events. Saving to Firestore...`);

      for (const event of data.events) {
        const eventData = {
          title: event.name.text,
          description: event.description.text,
          date: event.start.utc,
          location: event.venue?.address?.localized_address_display || "Online",
          organization: event.organization_id || "Eventbrite",
          signupURL: event.url,
          status: "open",
          tags: ["eventbrite", "free", "public"],
        };

        console.log(`📌 Saving event: ${event.name.text}`);
        await db.collection("events").doc(event.id).set(eventData, { merge: true });
      }

      const message = `✅ Saved ${data.events.length} events from Eventbrite.`;
      console.log(message);
      res.status(200).send(message);
    } catch (err) {
      console.error("🔥 Error pulling Eventbrite events:", err);
      res.status(500).send("Something went wrong.");
    }
  });
