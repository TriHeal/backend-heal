const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();

const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

exports.health = onRequest((req, res) => {
  res.status(200).json({
    ok: true,
    service: "tri-heal-backend",
    timestamp: new Date().toISOString(),
  });
});

exports.createPatient = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { therapistId, displayName, age, avatarUrl } = req.body || {};

    if (!therapistId || !displayName || !age) {
      return res.status(400).json({
        error: "Missing required fields: therapistId, displayName, age",
      });
    }

    const now = FieldValue.serverTimestamp();

    const patientRef = await db.collection("patients").add({
      therapistId,
      displayName,
      age,
      avatarUrl: avatarUrl || null,
      status: "active",
      enrolledAt: now,
      createdAt: now,
      updatedAt: now,
      parents: [],
    });

    return res.status(201).json({
      patientId: patientRef.id,
      message: "Patient created successfully",
    });
  } catch (error) {
    console.error("createPatient failed:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});