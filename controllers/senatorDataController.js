const mongoose = require("mongoose");
const SenatorData = require("../models/senatorDataSchema");
const Senator = require("../models/senatorSchema");
const Vote = require("../models/voteSchema");
const Term = require("../models/termSchema");
const Activity = require("../models/activitySchema");
const { findMatchingTerm } = require("../helper/bulkUpdateHelper");
class senatorDataController {
  // Create a new senator data
  static async createSenatorData(req, res) {
    try {
      const {
        senateId,
        termId,
        currentTerm,
        summary,
        rating,
        votesScore,
        activitiesScore,
        pastVotesScore = [],
      } = req.body;
      if (
        !mongoose.Types.ObjectId.isValid(senateId) ||
        !mongoose.Types.ObjectId.isValid(termId)
      ) {
        return res.status(400).json({
          message: "Invalid senateId or termId format",
        });
      }
      const senateObjectId = new mongoose.Types.ObjectId(senateId);
      const termObjectId = new mongoose.Types.ObjectId(termId);
      const [termDetails, existingCurrentTerm, existingData] =
        await Promise.all([
          mongoose.model("terms").findById(termObjectId),
          currentTerm
            ? SenatorData.findOne({
                senateId: senateObjectId,
                currentTerm: true,
              })
            : null,
          SenatorData.findOne({
            senateId: senateObjectId,
            termId: termObjectId,
          }),
        ]);
      if (!termDetails) {
        return res.status(400).json({
          message: "Invalid term ID provided",
        });
      }
      if (existingData) {
        return res.status(409).json({
          message: "Duplicate senator data found",
          details:
            "A record already exists with the same senator and term combination",
          existingData,
        });
      }
      if (currentTerm && existingCurrentTerm) {
        return res.status(409).json({
          message: "Another term is already marked as current for this senator",
          existingCurrentTerm,
        });
      }
      const newSenatorData = new SenatorData({
        senateId: senateObjectId,
        termId: termObjectId,
        summary,
        currentTerm: currentTerm || false,
        rating,
        votesScore,
        activitiesScore,
        pastVotesScore,
      });
      const savedData = await newSenatorData.save();
      const populatedData = await SenatorData.findById(savedData._id)
        .populate("senateId", "name title")
        .populate("termId", "name startYear endYear")
        .lean();

      res.status(201).json({
        message: "Senator data created successfully",
        data: populatedData || savedData,
      });
    } catch (error) {
      console.error("Error creating senator data:", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({
          message: "Validation failed",
          details: Object.values(error.errors).map((err) => err.message),
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Duplicate entry detected",
          details:
            "A record with this senator and term combination already exists",
        });
      }
      res.status(500).json({
        message: "Error creating senator data",
        error: process.env.NODE_ENV === "production" ? {} : error.message,
      });
    }
  }
  static async getAllSenatorData(req, res) {
    try {
      const senatorData = await SenatorData.find()
        .populate("votesScore.voteId")
        .populate("activitiesScore.activityId");

      res.status(200).json(senatorData);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving senator data", error });
    }
  }
  static async getSenatorDataById(req, res) {
    try {
      const senatorData = await SenatorData.findById(req.params.id)
        .populate("votesScore.voteId")
        .populate("activitiesScore.activityId");

      if (!senatorData) {
        return res.status(404).json({ message: "Senator data not found" });
      }

      res.status(200).json(senatorData);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving senator data", error });
    }
  }
  // static async updateSenatorData(req, res) {
  //   try {
  //     const { termId, senateId } = req.body;
  //     if (!termId || termId.toString().trim() === "") {
  //       return res.status(400).json({ message: "Term is required" });
  //     }
  //     if (!senateId || senateId.toString().trim() === "") {
  //       return res.status(400).json({ message: "Senate ID is required" });
  //     }
  //     const existing = await SenatorData.findById(req.params.id);
  //     if (!existing) {
  //       return res.status(404).json({ message: "Senator data not found" });
  //     }
  //     Object.assign(existing, req.body);
  //     const updated = await existing.save();
  //     res.status(200).json(updated);
  //   } catch (error) {
  //     if (error.name === "ValidationError") {
  //       const messages = Object.values(error.errors).map((err) => err.message);
  //       return res.status(400).json({ message: messages.join(", ") });
  //     }
  //     res.status(500).json({
  //       message: error.message || "Error updating senator data",
  //       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  //     });
  //   }
  // }
  static async updateSenatorData(req, res) {
    try {
      const { termId, senateId } = req.body;

      // ✅ senateId is ALWAYS required
      if (!senateId || senateId.toString().trim() === "") {
        return res.status(400).json({ message: "Senate ID is required" });
      }

      // ❌ termId is OPTIONAL (important fix)
      if (termId !== undefined && termId !== null) {
        if (termId.toString().trim() === "") {
          return res.status(400).json({ message: "Invalid termId" });
        }
      }

      const existing = await SenatorData.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Senator data not found" });
      }

      // ✅ SAFE ASSIGN (no overwrite of _id)
      Object.keys(req.body).forEach((key) => {
        if (key !== "_id") {
          existing[key] = req.body[key];
        }
      });

      const updated = await existing.save();
      return res.status(200).json(updated);
    } catch (error) {
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({ message: messages.join(", ") });
      }

      return res.status(500).json({
        message: error.message || "Error updating senator data",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  static async deleteSenatorData(req, res) {
    try {
      const senatorDataToDelete = await SenatorData.findById(req.params.id);
      if (!senatorDataToDelete) {
        return res.status(404).json({ message: "Senator data not found" });
      }
      const senatorId = senatorDataToDelete.senateId;
      const senator = await Senator.findById(senatorId);
      if (!senator) {
        return res.status(404).json({ message: "Senator not found" });
      }
      const senatorDataList = await SenatorData.find({
        senateId: senatorId,
      }).lean();
      const { _id, createdAt, updatedAt, __v, history, ...currentState } =
        senator.toObject();
      const stateWithData = {
        ...currentState,
        senatorData: senatorDataList,
      };
      let updateOps = { $set: { snapshotSource: "deleted_pending_update" } };

      if (!senator.history || senator.history.length === 0) {
        const historyEntry = {
          oldData: stateWithData,
          timestamp: new Date(),
          actionType: "delete",
          deletedDataId: req.params.id,
          deletedData: senatorDataToDelete.toObject(),
        };

        updateOps.$push = { history: historyEntry };
      }
      await Promise.all([
        Senator.findByIdAndUpdate(senatorId, updateOps),
        SenatorData.findByIdAndDelete(req.params.id),
      ]);
      res.status(200).json({
        message: "Senator data deleted successfully",
        data: senatorDataToDelete,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error deleting senator data",
        error: error.message,
      });
    }
  }

  static async getSenatorDataBySenatorId(req, res) {
    try {
      const senateId = req.params.id;

      const senatorData = await SenatorData.find({ senateId })
        .select("-__v -createdAt -updatedAt")
        .sort({ createdAt: 1 })
        .populate("termId", "-__v -createdAt -updatedAt")
        .populate(
          "senateId",
          "name state party photo status senatorId publishStatus",
        )
        .populate({
          path: "votesScore.voteId",
          select: "title result date termId",
          populate: {
            path: "termId",
            select: "name start end",
          },
        })
        .populate({
          path: "activitiesScore.activityId",
          select: "title quorumId status date",
        })
        .populate({
          path: "pastVotesScore.voteId",
          select: "title result date termId",
          populate: {
            path: "termId",
            select: "name start end",
          },
        })
        .lean();

      if (!senatorData.length) {
        return res.status(404).json({ message: "Senator data not found" });
      }

      // Sort votes and activities by date in ascending order for each term
      const sortedSenatorData = senatorData.map((term) => {
        // Sort votesScore by vote date (ascending)
        if (term.votesScore && term.votesScore.length > 0) {
          term.votesScore.sort((a, b) => {
            const dateA = a.voteId?.date
              ? new Date(a.voteId.date)
              : new Date(0);
            const dateB = b.voteId?.date
              ? new Date(b.voteId.date)
              : new Date(0);
            return dateA - dateB; // Ascending order
          });
        }

        // Sort activitiesScore by activity date (ascending)
        if (term.activitiesScore && term.activitiesScore.length > 0) {
          term.activitiesScore.sort((a, b) => {
            const dateA = a.activityId?.date
              ? new Date(a.activityId.date)
              : new Date(0);
            const dateB = b.activityId?.date
              ? new Date(b.activityId.date)
              : new Date(0);
            return dateA - dateB; // Ascending order
          });
        }

        // Sort pastVotesScore by vote date (ascending)
        if (term.pastVotesScore && term.pastVotesScore.length > 0) {
          term.pastVotesScore.sort((a, b) => {
            const dateA = a.voteId?.date
              ? new Date(a.voteId.date)
              : new Date(0);
            const dateB = b.voteId?.date
              ? new Date(b.voteId.date)
              : new Date(0);
            return dateA - dateB; // Ascending order
          });
        }

        return term;
      });

      const orderedData = sortedSenatorData.sort((a, b) => {
        if (a.currentTerm && !b.currentTerm) return -1;
        if (!a.currentTerm && b.currentTerm) return 1;
        return 0;
      });

      res.status(200).json({
        message: "Retrieve successfully",
        info: orderedData,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error retrieving senator data",
        error: error.message,
      });
    }
  }

  static async SenatorDataBySenatorId(req, res) {
    try {
      const senateId = req.params.senatorId;

      // Get senator doc
      const senatorDocument = await Senator.findById(senateId).lean();
      if (!senatorDocument) {
        return res.status(404).json({ message: "Senator data not found" });
      }

      const latestHistory = senatorDocument.history?.slice(-1)[0];
      const hasHistoricalData = latestHistory?.oldData?.senatorData?.length > 0;

      // ---- Helpers ----
      const cleanVoteOrActivity = (doc) =>
        doc && {
          _id: doc._id,
          title: doc.title || null,
          shortDesc: doc.shortDesc || null,
          longDesc: doc.longDesc || null,
          rollCall: doc.rollCall || null,
          readMore: doc.readMore || null,
          sbaPosition: doc.sbaPosition || null,
          date: doc.date || null,
          congress: doc.congress || null,
        };

      const getSenatorDetails = (sourceData, isHistorical = false) => ({
        _id: senatorDocument._id,
        name: sourceData.name || senatorDocument.name,
        state: sourceData.state || senatorDocument.state,
        party: sourceData.party || senatorDocument.party,
        photo: sourceData.photo || senatorDocument.photo,
        status: sourceData.status || senatorDocument.status,
        isNewRecord: sourceData.isNewRecord || senatorDocument.isNewRecord,
        senatorId: sourceData.senatorId || senatorDocument.senatorId,
        publishStatus: isHistorical
          ? "published"
          : senatorDocument.publishStatus,
        createdAt: senatorDocument.createdAt,
        updatedAt: isHistorical
          ? latestHistory?.timestamp
          : senatorDocument.updatedAt,
      });

      let finalCurrentTerm = null;
      let finalPastTerms = [];
      let senatorDetails = null;

      if (hasHistoricalData) {
        senatorDetails = getSenatorDetails(latestHistory.oldData, true);
        const historicalTerms = latestHistory.oldData.senatorData;
        const allTermIds = historicalTerms.map((t) => t.termId);

        // Get all vote IDs from both votesScore AND pastVotesScore
        const allVoteIds = historicalTerms.flatMap((t) => {
          const votesScoreIds = (t.votesScore || []).map((v) => v.voteId);
          const pastVotesScoreIds = (t.pastVotesScore || []).map(
            (v) => v.voteId,
          );
          return [...votesScoreIds, ...pastVotesScoreIds];
        });

        const allActivityIds = historicalTerms.flatMap((t) =>
          (t.activitiesScore || []).map((a) => a.activityId),
        );

        const [termDocs, voteDocs, activityDocs] = await Promise.all([
          Term.find({ _id: { $in: allTermIds } }).lean(),
          Vote.find({ _id: { $in: allVoteIds } }).lean(),
          Activity.find({ _id: { $in: allActivityIds } }).lean(),
        ]);

        const termMap = Object.fromEntries(
          termDocs.map((d) => [String(d._id), d]),
        );
        const voteMap = Object.fromEntries(
          voteDocs.map((d) => [String(d._id), cleanVoteOrActivity(d)]),
        );
        const activityMap = Object.fromEntries(
          activityDocs.map((d) => [String(d._id), cleanVoteOrActivity(d)]),
        );

        const populatedTerms = historicalTerms.map((term) => ({
          _id: term._id,
          termId: termMap[String(term.termId)] || null,
          currentTerm: term.currentTerm,
          summary: term.summary,
          rating: term.rating,
          votesScore: (term.votesScore || []).map((v) => ({
            score: v.score,
            voteId: voteMap[String(v.voteId)] || null,
          })),
          // ADDED: Include pastVotesScore with the same structure
          pastVotesScore: (term.pastVotesScore || []).map((v) => ({
            score: v.score,
            voteId: voteMap[String(v.voteId)] || null,
          })),
          activitiesScore: (term.activitiesScore || []).map((a) => ({
            score: a.score,
            activityId: activityMap[String(a.activityId)] || null,
          })),
        }));

        finalCurrentTerm = populatedTerms.find((t) => t.currentTerm) || null;
        finalPastTerms = populatedTerms.filter((t) => !t.currentTerm);
      } else {
        // MODIFIED: Added pastVotesScore population to existing queries
        const [currentTerm, pastTerms] = await Promise.all([
          SenatorData.findOne({ senateId, currentTerm: true })
            .populate("termId", "_id name startYear endYear congresses")
            .populate(
              "votesScore.voteId",
              "_id title shortDesc longDesc rollCall readMore sbaPosition date congress",
            )
            .populate(
              // ADDED: populate pastVotesScore
              "pastVotesScore.voteId",
              "_id title shortDesc longDesc rollCall readMore sbaPosition date congress",
            )
            .populate(
              "activitiesScore.activityId",
              "_id title shortDesc longDesc rollCall readMore sbaPosition date congress",
            )
            .lean(),
          SenatorData.find({ senateId, currentTerm: { $ne: true } })
            .populate("termId", "_id name startYear endYear congresses")
            .populate(
              "votesScore.voteId",
              "_id title shortDesc longDesc rollCall readMore sbaPosition date congress",
            )
            .populate(
              // ADDED: populate pastVotesScore
              "pastVotesScore.voteId",
              "_id title shortDesc longDesc rollCall readMore sbaPosition date congress",
            )
            .populate(
              "activitiesScore.activityId",
              "_id title shortDesc longDesc rollCall readMore sbaPosition date congress",
            )
            .sort({ "termId.startYear": -1, createdAt: -1 })
            .lean(),
        ]);

        senatorDetails = getSenatorDetails(senatorDocument, false);

        const formatTermData = (term) => ({
          _id: term._id,
          termId: term.termId,
          currentTerm: term.currentTerm,
          summary: term.summary,
          rating: term.rating,
          votesScore: (term.votesScore || []).map((v) => ({
            score: v.score,
            voteId: cleanVoteOrActivity(v.voteId),
          })),
          // ADDED: Include pastVotesScore with the same formatting
          pastVotesScore: (term.pastVotesScore || []).map((v) => ({
            score: v.score,
            voteId: cleanVoteOrActivity(v.voteId),
          })),
          activitiesScore: (term.activitiesScore || []).map((a) => ({
            score: a.score,
            activityId: cleanVoteOrActivity(a.activityId),
          })),
        });

        if (currentTerm) finalCurrentTerm = formatTermData(currentTerm);
        finalPastTerms = pastTerms.map(formatTermData);
      }
      res.status(200).json({
        message: "Retrieved successfully",
        senator: senatorDetails,
        currentTerm: finalCurrentTerm,
        pastTerms: finalPastTerms,
        dataSource: hasHistoricalData ? "historical" : "current",
        hasHistoricalData,
      });
    } catch (error) {
      console.error("Error retrieving senator data:", error);
      res.status(500).json({
        message: "Error retrieving senator data",
        error: error.message,
      });
    }
  }

  static async getPastVotesWithDetails(req, res) {
    try {
      const { senateId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(senateId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid senate ID format",
        });
      }

      // Fetch senator's name
      const senator = await Senator.findById(senateId).select("name").lean();
      const senatorName = senator ? senator.name : null;

      const voteDetails = await SenatorData.aggregate([
        { $match: { senateId: new mongoose.Types.ObjectId(senateId) } },
        {
          $match: {
            pastVotesScore: { $exists: true, $ne: [] },
            "pastVotesScore.0": { $exists: true },
          },
        },
        { $unwind: "$pastVotesScore" },
        {
          $lookup: {
            from: "votes",
            localField: "pastVotesScore.voteId",
            foreignField: "_id",
            as: "voteDetails",
          },
        },
        { $unwind: "$voteDetails" },
        {
          $project: {
            _id: "$voteDetails._id",
            type: "$voteDetails.type",
            title: "$voteDetails.title",
            date: "$voteDetails.date",
            congress: "$voteDetails.congress",
            shortDesc: "$voteDetails.shortDesc",
            readMore: "$voteDetails.readMore",
            rollCall: "$voteDetails.rollCall",
            sbaPosition: "$voteDetails.sbaPosition",
            status: "$voteDetails.status",
            score: "$pastVotesScore.score",
            voteScoreId: "$pastVotesScore._id",
          },
        },
        { $sort: { date: -1 } },
      ]);

      if (!voteDetails.length) {
        return res.status(404).json({
          success: false,
          message: "No past votes found for this senator",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          senateId,
          name: senatorName,
          pastVotes: voteDetails,
          count: voteDetails.length,
        },
      });
    } catch (error) {
      console.error("Error fetching past votes:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  static async bulkPublish(req, res) {
    try {
      const { senatorIds = [] } = req.body;
      if (!Array.isArray(senatorIds) || senatorIds.length === 0) {
        console.warn("⚠️ No senator IDs provided");
        return res.status(400).json({ message: "No senators selected" });
      }
      const terms = await Term.find().lean();
      let successCount = 0;
      const errors = [];

      for (const senateId of senatorIds) {
        try {
          let hasError = false;
          const senatorErrors = [];

          /* ------------------ FETCH SENATOR DATA ------------------ */
          const termRecords = await SenatorData.find({ senateId })
            .populate("termId")
            .populate("votesScore.voteId")
            .populate("activitiesScore.activityId")
            .populate("pastVotesScore.voteId")
            .lean();

          if (termRecords && termRecords.length > 0) {
            // Create a DEEP COPY of termRecords for processing
            const termRecordsCopy = JSON.parse(JSON.stringify(termRecords));

            // Track moves needed
            const votesToMoveBetweenTerms = []; // { fromTermId, toTermId, voteScore }
            const activitiesToMoveBetweenTerms = []; // { fromTermId, toTermId, activityScore }

            // Track unique vote/activity IDs to detect duplicates
            const seenVoteIds = new Set();
            const seenActivityIds = new Set();
            const duplicateVotes = new Set();
            const duplicateActivities = new Set();

            // First pass: Check ALL votes/activities for term matching
            for (const term of termRecordsCopy) {
              /* -------- CHECK VOTES -------- */
              if (
                Array.isArray(term.votesScore) &&
                term.votesScore.length > 0
              ) {
                for (let i = 0; i < term.votesScore.length; i++) {
                  const voteScore = term.votesScore[i];
                  const voteDoc = voteScore.voteId;
                  const voteId = voteDoc?._id || voteScore.voteId;
                  const voteDate = voteDoc?.date;
                  // Check for duplicate votes
                  const voteIdStr = voteId.toString();
                  if (seenVoteIds.has(voteIdStr)) {
                    duplicateVotes.add(voteIdStr);
                  } else {
                    seenVoteIds.add(voteIdStr);
                  }

                  if (!voteDate) {
                    hasError = true;
                    senatorErrors.push(
                      `Vote (ID: ${voteId}): Term is required - no date found`,
                    );
                    continue;
                  }

                  const match = await findMatchingTerm(
                    termRecordsCopy,
                    terms,
                    voteDate,
                  );

                  if (!match) {
                    hasError = true;
                    senatorErrors.push(
                      `Vote (ID: ${voteId}, date: ${voteDate}): Term is required`,
                    );
                  } else if (match.type === "past") {
                  } else if (match.type === "current") {
                    // Check if vote is in the correct term
                    const correctTermId = match.term._id.toString();
                    const currentTermId = term._id.toString();

                    if (correctTermId === currentTermId) {
                    } else {
                      // Track for moving later
                      votesToMoveBetweenTerms.push({
                        fromTermId: currentTermId,
                        toTermId: correctTermId,
                        voteScore: voteScore,
                        voteId: voteIdStr,
                      });
                    }
                  }
                }
              } else {
                console.log(`\n🗳️ VOTES: None`);
              }

              /* -------- CHECK ACTIVITIES -------- */
              if (
                Array.isArray(term.activitiesScore) &&
                term.activitiesScore.length > 0
              ) {
                for (let i = 0; i < term.activitiesScore.length; i++) {
                  const actScore = term.activitiesScore[i];
                  const actDoc = actScore.activityId;
                  const actId = actDoc?._id || actScore.activityId;
                  const actDate = actDoc?.date;
                  // Check for duplicate activities
                  const actIdStr = actId.toString();
                  if (seenActivityIds.has(actIdStr)) {
                    duplicateActivities.add(actIdStr);
                  } else {
                    seenActivityIds.add(actIdStr);
                  }

                  if (!actDate) {
                    hasError = true;
                    senatorErrors.push(
                      `Activity (ID: ${actId}): Term is required - no date found`,
                    );
                    continue;
                  }

                  const match = await findMatchingTerm(
                    termRecordsCopy,
                    terms,
                    actDate,
                  );

                  if (!match) {
                    hasError = true;
                    senatorErrors.push(
                      `Activity (ID: ${actId}, date: ${actDate}): Term is required`,
                    );
                  } else if (match.type === "current") {
                    // Check if activity is in the correct term
                    const correctTermId = match.term._id.toString();
                    const currentTermId = term._id.toString();

                    if (correctTermId === currentTermId) {
                    } else {
                      // Track for moving later
                      activitiesToMoveBetweenTerms.push({
                        fromTermId: currentTermId,
                        toTermId: correctTermId,
                        activityScore: actScore,
                        activityId: actIdStr,
                      });
                    }
                  }
                }
              } else {
                console.log(`\n🏃 ACTIVITIES: None`);
              }
            }
            /* -------- REMOVE DUPLICATES WITHIN SAME TERM -------- */
            let sameTermDupActivities = 0;
            let sameTermDupVotes = 0;

            // Check each term for duplicates within itself
            for (const term of termRecords) {
              const termId = term._id.toString();

              /* -------- CHECK ACTIVITY DUPLICATES WITHIN TERM -------- */
              if (
                Array.isArray(term.activitiesScore) &&
                term.activitiesScore.length > 0
              ) {
                const seenActIds = new Set();
                const uniqueActivities = [];
                const duplicateActIds = [];

                for (const actScore of term.activitiesScore) {
                  const actId = (
                    actScore.activityId?._id || actScore.activityId
                  ).toString();

                  if (seenActIds.has(actId)) {
                    duplicateActIds.push(actId);
                    sameTermDupActivities++;
                  } else {
                    seenActIds.add(actId);
                    uniqueActivities.push(actScore);
                  }
                }

                // Update if duplicates found
                if (duplicateActIds.length > 0) {
                  await SenatorData.findByIdAndUpdate(
                    termId,
                    { activitiesScore: uniqueActivities },
                    { new: true },
                  );
                }
              }

              /* -------- CHECK VOTE DUPLICATES WITHIN TERM -------- */
              if (
                Array.isArray(term.votesScore) &&
                term.votesScore.length > 0
              ) {
                const seenVoteIds = new Set();
                const uniqueVotes = [];
                const duplicateVoteIds = [];

                for (const voteScore of term.votesScore) {
                  const voteId = (
                    voteScore.voteId?._id || voteScore.voteId
                  ).toString();

                  if (seenVoteIds.has(voteId)) {
                    duplicateVoteIds.push(voteId);
                    sameTermDupVotes++;
                  } else {
                    seenVoteIds.add(voteId);
                    uniqueVotes.push(voteScore);
                  }
                }

                // Update if duplicates found
                if (duplicateVoteIds.length > 0) {
                  await SenatorData.findByIdAndUpdate(
                    termId,
                    { votesScore: uniqueVotes },
                    { new: true },
                  );
                }
              }
            }
            // If ANY critical error found, skip this senator entirely
            if (hasError) {
              errors.push({
                senatorId: senateId,
                message: "Critical errors found",
                details: senatorErrors,
              });
              continue;
            }
            // Create a map of term records for easy access
            const termRecordsMap = {};
            termRecords.forEach((tr) => {
              termRecordsMap[tr._id.toString()] = tr;
            });

            /* -------- MOVE MISPLACED VOTES BETWEEN TERMS -------- */
            if (votesToMoveBetweenTerms.length > 0) {
              // Group moves by destination term and track which votes are being moved
              const movesByDestTerm = {};
              const votesBeingMoved = new Set(); // Track vote IDs that are being moved

              votesToMoveBetweenTerms.forEach((move) => {
                if (!movesByDestTerm[move.toTermId]) {
                  movesByDestTerm[move.toTermId] = [];
                }
                movesByDestTerm[move.toTermId].push(move);
                votesBeingMoved.add(move.voteId);
              });

              // FIRST: Remove votes from ALL terms where they shouldn't be
              // A vote should only exist in its correct term
              const votesToRemoveFromAllTerms = new Set(votesBeingMoved);

              // Process each term to remove votes that are being moved elsewhere
              for (const term of termRecords) {
                const termId = term._id.toString();
                const votesInThisTerm = term.votesScore || [];

                // Filter out votes that are being moved to OTHER terms
                // But keep votes that are staying in this term (correct placement)
                const remainingVotes = votesInThisTerm.filter((voteScore) => {
                  const voteId = (
                    voteScore.voteId?._id || voteScore.voteId
                  ).toString();

                  // Check if this vote is marked to be moved FROM this term
                  const isMovingFromThisTerm = votesToMoveBetweenTerms.some(
                    (move) =>
                      move.fromTermId === termId && move.voteId === voteId,
                  );

                  // Check if this vote is marked to be moved TO this term (keep it)
                  const isMovingToThisTerm = votesToMoveBetweenTerms.some(
                    (move) =>
                      move.toTermId === termId && move.voteId === voteId,
                  );

                  // Keep vote if:
                  // 1. It's not being moved at all, OR
                  // 2. It's being moved TO this term (its correct destination)
                  return !isMovingFromThisTerm || isMovingToThisTerm;
                });

                // Update the term if votes were removed
                if (remainingVotes.length !== votesInThisTerm.length) {
                  await SenatorData.findByIdAndUpdate(
                    termId,
                    { votesScore: remainingVotes },
                    { new: true },
                  );
                }
              }

              // SECOND: Add votes to their correct destination terms
              // But first, ensure we don't add duplicates
              for (const [toTermId, moves] of Object.entries(movesByDestTerm)) {
                const destTerm = termRecordsMap[toTermId];
                if (!destTerm) continue;

                // Get current votes in destination term
                const currentVotes = destTerm.votesScore || [];

                // Create a set of vote IDs already in destination term
                const existingVoteIds = new Set();
                currentVotes.forEach((vote) => {
                  const voteId = (vote.voteId?._id || vote.voteId).toString();
                  existingVoteIds.add(voteId);
                });

                // Filter moves to only add votes that aren't already in the destination
                const votesToAdd = [];
                const duplicateVotesSkipped = [];

                moves.forEach((move) => {
                  if (existingVoteIds.has(move.voteId)) {
                    duplicateVotesSkipped.push(move.voteId);
                  } else {
                    votesToAdd.push(move.voteScore);
                    existingVoteIds.add(move.voteId); // Add to set to prevent duplicates in this batch
                  }
                });

                // Only update if we have votes to add
                if (votesToAdd.length > 0) {
                  const updatedVotes = [...currentVotes, ...votesToAdd];

                  await SenatorData.findByIdAndUpdate(
                    toTermId,
                    { votesScore: updatedVotes },
                    { new: true },
                  );
                }
              }
            }

            /* -------- MOVE MISPLACED ACTIVITIES BETWEEN TERMS -------- */
            if (activitiesToMoveBetweenTerms.length > 0) {
              // Group moves by destination term and track which activities are being moved
              const movesByDestTerm = {};
              const activitiesBeingMoved = new Set();

              activitiesToMoveBetweenTerms.forEach((move) => {
                if (!movesByDestTerm[move.toTermId]) {
                  movesByDestTerm[move.toTermId] = [];
                }
                movesByDestTerm[move.toTermId].push(move);
                activitiesBeingMoved.add(move.activityId);
              });

              // FIRST: Remove activities from ALL terms where they shouldn't be
              const activitiesToRemoveFromAllTerms = new Set(
                activitiesBeingMoved,
              );

              // Process each term to remove activities that are being moved elsewhere
              for (const term of termRecords) {
                const termId = term._id.toString();
                const activitiesInThisTerm = term.activitiesScore || [];

                // Filter out activities that are being moved to OTHER terms
                const remainingActivities = activitiesInThisTerm.filter(
                  (actScore) => {
                    const actId = (
                      actScore.activityId?._id || actScore.activityId
                    ).toString();

                    // Check if this activity is marked to be moved FROM this term
                    const isMovingFromThisTerm =
                      activitiesToMoveBetweenTerms.some(
                        (move) =>
                          move.fromTermId === termId &&
                          move.activityId === actId,
                      );

                    // Check if this activity is marked to be moved TO this term (keep it)
                    const isMovingToThisTerm =
                      activitiesToMoveBetweenTerms.some(
                        (move) =>
                          move.toTermId === termId && move.activityId === actId,
                      );

                    // Keep activity if:
                    // 1. It's not being moved at all, OR
                    // 2. It's being moved TO this term (its correct destination)
                    return !isMovingFromThisTerm || isMovingToThisTerm;
                  },
                );

                // Update the term if activities were removed
                if (
                  remainingActivities.length !== activitiesInThisTerm.length
                ) {
                  await SenatorData.findByIdAndUpdate(
                    termId,
                    { activitiesScore: remainingActivities },
                    { new: true },
                  );
                }
              }

              // SECOND: Add activities to their correct destination terms
              for (const [toTermId, moves] of Object.entries(movesByDestTerm)) {
                const destTerm = termRecordsMap[toTermId];
                if (!destTerm) continue;

                // Get current activities in destination term
                const currentActivities = destTerm.activitiesScore || [];

                // Create a set of activity IDs already in destination term
                const existingActivityIds = new Set();
                currentActivities.forEach((act) => {
                  const actId = (
                    act.activityId?._id || act.activityId
                  ).toString();
                  existingActivityIds.add(actId);
                });

                // Filter moves to only add activities that aren't already in the destination
                const activitiesToAdd = [];
                const duplicateActivitiesSkipped = [];

                moves.forEach((move) => {
                  if (existingActivityIds.has(move.activityId)) {
                    duplicateActivitiesSkipped.push(move.activityId);
                  } else {
                    activitiesToAdd.push(move.activityScore);
                    existingActivityIds.add(move.activityId);
                  }
                });

                // Only update if we have activities to add
                if (activitiesToAdd.length > 0) {
                  const updatedActivities = [
                    ...currentActivities,
                    ...activitiesToAdd,
                  ];

                  await SenatorData.findByIdAndUpdate(
                    toTermId,
                    { activitiesScore: updatedActivities },
                    { new: true },
                  );
                  if (duplicateActivitiesSkipped.length > 0) {
                    console.log(
                      `   Skipped ${duplicateActivitiesSkipped.length} duplicate activities already in term`,
                    );
                  }
                }
              }
            }

            /* -------- MOVE PAST VOTES TO pastVotesScore -------- */
            // Process the ORIGINAL termRecords (not the copy) for updates
            for (const term of termRecords) {
              if (
                Array.isArray(term.votesScore) &&
                term.votesScore.length > 0
              ) {
                const newPastVotes = [];
                const remainingVotes = [];

                for (const voteScore of term.votesScore) {
                  const voteDoc = voteScore.voteId;
                  const voteDate = voteDoc?.date;

                  if (!voteDate) continue;

                  const match = findMatchingTerm(termRecords, terms, voteDate);

                  if (match?.type === "past") {
                    newPastVotes.push(voteScore);
                  } else {
                    remainingVotes.push(voteScore);
                  }
                }

                // Only update if we actually have votes to move
                if (newPastVotes.length > 0) {
                  const updatedPastVotes = [
                    ...(term.pastVotesScore || []),
                    ...newPastVotes,
                  ];

                  await SenatorData.findByIdAndUpdate(
                    term._id,
                    {
                      votesScore: remainingVotes,
                      pastVotesScore: updatedPastVotes,
                    },
                    { new: true },
                  );
                }
              }
            }
            await Senator.findByIdAndUpdate(
              senateId,
              {
                publishStatus: "published",
                editedFields: [],
                fieldEditors: {},
                history: [],
              },
              { new: true },
            );

            successCount++;
          } else {
            errors.push({
              senatorId: senateId,
              message: "No term records found",
            });
          }
        } catch (err) {
          console.error(
            `❌ FAILED TO PROCESS SENATOR ${senateId}:`,
            err.message,
          );
          console.error(err.stack);
          errors.push({
            senatorId: senateId,
            message: err.message,
          });
        }
      }

      return res.status(200).json({
        successCount,
        totalCount: senatorIds.length,
        message: `Bulk publish completed for ${successCount}/${senatorIds.length} senators`,
        errors: errors.length > 0 ? errors : null,
      });
    } catch (err) {
      console.error("🔥 BULK PUBLISH API ERROR:", err.message);
      console.error(err.stack);
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = senatorDataController;
