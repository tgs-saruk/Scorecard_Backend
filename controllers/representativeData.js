const HouseData = require("../models/representativeDataSchema");
const House = require("../models/representativeSchema");
const Term = require("../models/termSchema");
const Vote = require("../models/voteSchema");
const Activity = require("../models/activitySchema");
const { getCongresses, isValidTerm } = require("../helper/termUtils");

const mongoose = require("mongoose");
class houseDataController {
  // Create a new house data with termId uniqueness validation
  static async createHouseData(req, res) {
    try {
      const {
        houseId,
        termId,
        currentTerm,
        summary,
        rating,
        votesScore,
        activitiesScore,
      } = req.body;

      let totalDeleted = 0;

      const delMissing = await HouseData.deleteMany({
        houseId,
        termId: { $exists: false },
      });
      totalDeleted += delMissing.deletedCount || 0;

      const delNull = await HouseData.deleteMany({ houseId, termId: null });
      totalDeleted += delNull.deletedCount || 0;

      try {
        const nativeDel = await HouseData.collection.deleteMany({
          houseId: new mongoose.Types.ObjectId(houseId),
          termId: "",
        });
        totalDeleted += nativeDel.deletedCount || 0;
      } catch (e) {}

      if (!houseId || !termId || termId.toString().trim() === "") {
        return res.status(400).json({
          message: "houseId and termId are required",
        });
      }

      const existingHouseData = await HouseData.findOne({ houseId, termId });

      if (existingHouseData) {
        return res.status(409).json({
          message: "House data already exists for this representative and term",
          existingData: existingHouseData,
        });
      }

      if (currentTerm === true) {
        const existingCurrentTerm = await HouseData.findOne({
          houseId,
          currentTerm: true,
        });

        if (existingCurrentTerm) {
          return res.status(409).json({
            message: "A current term already exists for this representative",
            existingCurrentTerm: existingCurrentTerm,
          });
        }
      }

      const newHouseData = new HouseData({
        houseId,
        termId,
        currentTerm,
        summary,
        rating,
        votesScore,
        activitiesScore,
      });

      await newHouseData.save();

      res.status(201).json({
        message: "House data added successfully",
        info: newHouseData,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({ message: messages.join(", ") });
      }

      res.status(500).json({
        message: "Error creating house data",
        error: error.message,
      });
    }
  }

  // Get all house data with populated votesScore and activitiesScore
  static async getAllHouseData(req, res) {
    try {
      const houseData = await HouseData.find()
        .populate("votesScore.voteId")
        .populate("activitiesScore.activityId");

      res.status(200).json(houseData);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error retrieving house data", error: error.message });
    }
  }

  // Get house data by ID with populated votesScore and activitiesScore
  static async getHouseDataById(req, res) {
    try {
      const houseData = await HouseData.findById(req.params.id)
        .populate("votesScore.voteId")
        .populate("activitiesScore.activityId");

      if (!houseData) {
        return res.status(404).json({ message: "House data not found" });
      }

      res.status(200).json(houseData);
    } catch (error) {
      res.status(500).json({
        message: "Error retrieving  house data",
        error: error.message,
      });
    }
  }

  // Update house data by ID
  static async updateHouseData(req, res) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const { termId, houseId } = req.body;

      if (!termId || termId.toString().trim() === "") {
        // Find and delete the document
        const documentToDelete = await HouseData.findById(
          req.params.id,
        ).session(session);

        if (documentToDelete) {
        }

        if (!documentToDelete) {
          return res.status(404).json({ message: "House data not found" });
        }

        await HouseData.findByIdAndDelete(req.params.id);

        return res.status(200).json({
          message: "House data deleted because termId was null/empty",
          deletedData: documentToDelete,
        });
      }

      // Optional: Validate houseId
      if (!houseId || houseId.toString().trim() === "") {
        return res.status(400).json({ message: "houseId is required" });
      }

      // Find the existing document
      const existing = await HouseData.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ message: "House data not found" });
      }

      // Check if termId is being changed to a different value
      const isTermIdChanging = existing.termId.toString() !== termId.toString();

      if (isTermIdChanging) {
        // Check if HouseData already exists for the new houseId + termId combination
        const duplicateHouseData = await HouseData.findOne({
          houseId: existing.houseId, // Use existing houseId to avoid changing it
          termId: termId,
          _id: { $ne: req.params.id },
        });

        if (duplicateHouseData) {
          return res.status(409).json({
            message:
              "House data already exists for this representative and term",
            existingData: duplicateHouseData,
          });
        }
      }

      // Apply the updates
      Object.assign(existing, req.body);

      // If currentTerm is being set to true, ensure no other currentTerm exists
      if (existing.currentTerm === true) {
        const existingCurrentTerm = await HouseData.findOne({
          houseId: existing.houseId,
          currentTerm: true,
          _id: { $ne: req.params.id },
        });

        if (existingCurrentTerm) {
          // Automatically update the existing currentTerm to false
          await HouseData.findByIdAndUpdate(existingCurrentTerm._id, {
            currentTerm: false,
          });
        }
      }

      // Save to trigger schema validation
      const updated = await existing.save();

      res.status(200).json({
        message: "House data updated successfully",
        data: updated,
      });
    } catch (error) {
      // Handle schema validation errors
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({ message: messages.join(", ") });
      }

      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(409).json({
          message: "House data already exists for this representative and term",
          error: error.message,
        });
      }

      res.status(500).json({
        message: error.message || "Error updating house data",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  // Delete house data by ID
  static async deleteHouseData(req, res) {
    try {
      // 1. Find the HouseData to be deleted
      const houseDataToDelete = await HouseData.findById(req.params.id);
      if (!houseDataToDelete) {
        return res.status(404).json({ message: "House data not found" });
      }

      // 2. Find the parent house
      const houseId = houseDataToDelete.houseId;
      const house = await House.findById(houseId);
      if (!house) {
        return res.status(404).json({ message: "House not found" });
      }

      // 3. Fetch all current HouseData for this house (before deletion)
      const houseDataList = await HouseData.find({ houseId: houseId }).lean();

      // 4. Prepare current state for history using object destructuring
      const { _id, createdAt, updatedAt, __v, history, ...currentState } =
        house.toObject();
      const stateWithData = {
        ...currentState,
        representativeData: houseDataList,
      };

      // 5. Only create history entry if no history exists
      let updateOps = { $set: { snapshotSource: "deleted_pending_update" } };

      if (!house.history || house.history.length === 0) {
        const historyEntry = {
          oldData: stateWithData,
          timestamp: new Date(),
          actionType: "delete",
          deletedDataId: req.params.id,
          deletedData: houseDataToDelete.toObject(),
        };

        updateOps.$push = { history: historyEntry };
      }

      // 6. Update house (with or without history) and delete the data
      await Promise.all([
        House.findByIdAndUpdate(houseId, updateOps),
        HouseData.findByIdAndDelete(req.params.id),
      ]);

      res.status(200).json({
        message: "House data deleted successfully",
        data: houseDataToDelete,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error deleting house data",
        error: error.message,
      });
    }
  }

  // static async getHouseDataByHouseId(req, res) {
  //   try {
  //     const houseId = req.params.id;

  //     // Fetch all terms and filter valid ones using utility
  //     const allTerms = await Term.find().sort({ startYear: -1 }).lean();
  //     const validTerms = allTerms.filter(isValidTerm);

  //     // Fetch all HouseData for this house - exclude history field from houseId population
  //     const houseData = await HouseData.find({ houseId })
  //       .sort({ createdAt: 1 })
  //       .populate({
  //         path: "houseId",
  //         select: "-history", // Exclude the history field
  //       })
  //       .populate({
  //         path: "votesScore.voteId",
  //         populate: { path: "termId" },
  //       })
  //       .populate("activitiesScore.activityId")
  //       .lean();

  //     if (!houseData.length) {
  //       return res.status(404).json({ message: "House data not found" });
  //     }

  //     const houseDetails = houseData[0].houseId;

  //     // Map termId -> metadata for quick access
  //     const termIdToMeta = new Map();
  //     for (const hd of houseData) {
  //       if (hd.termId) {
  //         termIdToMeta.set(hd.termId.toString(), {
  //           _id: hd._id?.toString() || null,
  //           currentTerm: Boolean(hd.currentTerm),
  //           rating: hd.rating || "",
  //           summary: hd.summary || "",
  //         });
  //       }
  //     }

  //     // Flatten all votes and activities
  //     const allVotes = houseData.flatMap((hd) => hd.votesScore || []);
  //     const allActivities = houseData.flatMap((hd) => hd.activitiesScore || []);

  //     // ✅ Build indexes for quick congress lookup
  //     const votesByCongress = new Map();
  //     for (const vote of allVotes) {
  //       const congress = Number(vote.voteId?.congress);
  //       if (!congress) continue;
  //       if (!votesByCongress.has(congress)) votesByCongress.set(congress, []);
  //       votesByCongress.get(congress).push(vote);
  //     }

  //     const activitiesByCongress = new Map();
  //     for (const activity of allActivities) {
  //       const congress = Number(activity.activityId?.congress);
  //       if (!congress) continue;
  //       if (!activitiesByCongress.has(congress))
  //         activitiesByCongress.set(congress, []);
  //       activitiesByCongress.get(congress).push(activity);
  //     }

  //     // ✅ Build terms with scores using indexed maps
  //     const termsWithScores = validTerms
  //       .map((term) => {
  //         const termCongresses = term.congresses || [];
  //         if (termCongresses.length !== 1) {
  //           return { termId: term, votesScore: [], activitiesScore: [] };
  //         }

  //         const singleCongress = termCongresses[0];

  //         // const votesForThisTerm = votesByCongress.get(singleCongress) || [];
  //         // const activitiesForThisTerm =
  //         //   activitiesByCongress.get(singleCongress) || [];
  //         // Votes sorted by date ASC, if same date → sort by _id ASC
  //         const votesForThisTerm = (
  //           votesByCongress.get(singleCongress) || []
  //         ).sort((a, b) => {
  //           const dateA = a.voteId?.date
  //             ? new Date(a.voteId.date)
  //             : new Date(0);
  //           const dateB = b.voteId?.date
  //             ? new Date(b.voteId.date)
  //             : new Date(0);

  //           if (dateA.getTime() === dateB.getTime()) {
  //             return (a.voteId?._id || "")
  //               .toString()
  //               .localeCompare((b.voteId?._id || "").toString());
  //           }

  //           return dateA - dateB;
  //         });

  //         // Activities sorted by date ASC, if same date → sort by _id ASC
  //         const activitiesForThisTerm = (
  //           activitiesByCongress.get(singleCongress) || []
  //         ).sort((a, b) => {
  //           const dateA = a.activityId?.date
  //             ? new Date(a.activityId.date)
  //             : new Date(0);
  //           const dateB = b.activityId?.date
  //             ? new Date(b.activityId.date)
  //             : new Date(0);

  //           if (dateA.getTime() === dateB.getTime()) {
  //             return (a.activityId?._id || "")
  //               .toString()
  //               .localeCompare((b.activityId?._id || "").toString());
  //           }

  //           return dateA - dateB;
  //         });

  //         const meta = termIdToMeta.get(term._id?.toString()) || {};
  //         return {
  //           _id: meta._id || null,
  //           termId: term,
  //           currentTerm: meta.currentTerm || false,
  //           rating: meta.rating || "",
  //           summary: meta.summary || "",
  //           votesScore: votesForThisTerm,
  //           activitiesScore: activitiesForThisTerm,
  //         };
  //       })
  //       .filter(
  //         (term) =>
  //           term.votesScore.length > 0 ||
  //           term.activitiesScore.length > 0 ||
  //           term._id
  //       );

  //     res.status(200).json({
  //       message: "Retrieved successfully",
  //       house: houseDetails,
  //       terms: termsWithScores,
  //     });
  //   } catch (error) {
  //     res.status(500).json({
  //       message: "Error retrieving house data",
  //       error: error.message,
  //     });
  //   }
  // }
  static async getHouseDataByHouseId(req, res) {
    try {
      const houseId = req.params.id;

      // Fetch all terms and filter valid ones using utility
      const allTerms = await Term.find().sort({ startYear: -1 }).lean();
      const validTerms = allTerms.filter(isValidTerm);

      // Fetch all HouseData for this house - exclude history field from houseId population
      const houseData = await HouseData.find({ houseId })
        .sort({ createdAt: 1 })
        .populate({
          path: "houseId",
          select: "-history", // Exclude the history field
        })
        .populate({
          path: "votesScore.voteId",
          populate: { path: "termId" },
        })
        .populate("activitiesScore.activityId")
        .lean();

      if (!houseData.length) {
        return res.status(404).json({ message: "House data not found" });
      }

      const houseDetails = houseData[0].houseId;

      // Map termId -> metadata for quick access
      const termIdToMeta = new Map();
      for (const hd of houseData) {
        if (hd.termId) {
          termIdToMeta.set(hd.termId.toString(), {
            _id: hd._id?.toString() || null,
            currentTerm: Boolean(hd.currentTerm),
            rating: hd.rating || "",
            summary: hd.summary || "",
          });
        }
      }

      // Flatten all votes and activities
      const allVotes = houseData.flatMap((hd) => hd.votesScore || []);
      const allActivities = houseData.flatMap((hd) => hd.activitiesScore || []);

      // ✅ Build indexes for quick congress lookup
      const votesByCongress = new Map();
      for (const vote of allVotes) {
        const congress = Number(vote.voteId?.congress);
        if (!congress) continue;
        if (!votesByCongress.has(congress)) votesByCongress.set(congress, []);
        votesByCongress.get(congress).push(vote);
      }

      const activitiesByCongress = new Map();
      for (const activity of allActivities) {
        const congress = Number(activity.activityId?.congress);
        if (!congress) continue;
        if (!activitiesByCongress.has(congress))
          activitiesByCongress.set(congress, []);
        activitiesByCongress.get(congress).push(activity);
      }

      // ✅ Build terms with scores using indexed maps
      const termsWithScores = validTerms
        .map((term) => {
          const termCongresses = term.congresses || [];
          if (termCongresses.length !== 1) {
            // For terms without exactly one congress, check if they should be current
            const meta = termIdToMeta.get(term._id?.toString()) || {};
            const isCurrentTerm = meta.currentTerm || term.currentTerm || false;

            return {
              _id: meta._id || null,
              termId: term,
              currentTerm: isCurrentTerm,
              rating: meta.rating || "",
              summary: meta.summary || "",
              votesScore: [],
              activitiesScore: [],
            };
          }

          const singleCongress = termCongresses[0];

          // Votes sorted by date ASC, if same date → sort by _id ASC
          const votesForThisTerm = (
            votesByCongress.get(singleCongress) || []
          ).sort((a, b) => {
            const dateA = a.voteId?.date
              ? new Date(a.voteId.date)
              : new Date(0);
            const dateB = b.voteId?.date
              ? new Date(b.voteId.date)
              : new Date(0);

            if (dateA.getTime() === dateB.getTime()) {
              return (a.voteId?._id || "")
                .toString()
                .localeCompare((b.voteId?._id || "").toString());
            }

            return dateA - dateB;
          });

          // Activities sorted by date ASC, if same date → sort by _id ASC
          const activitiesForThisTerm = (
            activitiesByCongress.get(singleCongress) || []
          ).sort((a, b) => {
            const dateA = a.activityId?.date
              ? new Date(a.activityId.date)
              : new Date(0);
            const dateB = b.activityId?.date
              ? new Date(b.activityId.date)
              : new Date(0);

            if (dateA.getTime() === dateB.getTime()) {
              return (a.activityId?._id || "")
                .toString()
                .localeCompare((b.activityId?._id || "").toString());
            }

            return dateA - dateB;
          });

          const meta = termIdToMeta.get(term._id?.toString()) || {};

          // Check if this is the current term
          // First priority: meta from HouseData, second priority: term's own currentTerm field
          const isCurrentTerm = meta.currentTerm || term.currentTerm || false;

          return {
            _id: meta._id || null,
            termId: term,
            currentTerm: isCurrentTerm,
            rating: meta.rating || "",
            summary: meta.summary || "",
            votesScore: votesForThisTerm,
            activitiesScore: activitiesForThisTerm,
          };
        })
        .filter(
          (term) =>
            term.votesScore.length > 0 ||
            term.activitiesScore.length > 0 ||
            term._id,
        );

      // Find the most recent term by startYear and set it as current if none are marked
      if (!termsWithScores.some((term) => term.currentTerm === true)) {
        const mostRecentTerm = termsWithScores.reduce((prev, current) => {
          return prev.termId.startYear > current.termId.startYear
            ? prev
            : current;
        });

        if (mostRecentTerm) {
          mostRecentTerm.currentTerm = true;
        }
      }

      res.status(200).json({
        message: "Retrieved successfully",
        house: houseDetails,
        terms: termsWithScores,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error retrieving house data",
        error: error.message,
      });
    }
  }
  // static async HouseDataByHouseId(req, res) {
  //   try {
  //     const houseId = req.params.repId;

  //     // Get main house document
  //     const houseDocument = await House.findById(houseId).lean();
  //     if (!houseDocument) {
  //       return res.status(404).json({ message: "House data not found" });
  //     }

  //     const latestHistory = houseDocument.history?.slice(-1)[0];
  //     const hasHistoricalData =
  //       latestHistory?.oldData?.representativeData?.length > 0;

  //     const cleanVoteOrActivity = (doc) =>
  //       doc && {
  //         _id: doc._id,
  //         title: doc.title || null,
  //         shortDesc: doc.shortDesc || null,
  //         longDesc: doc.longDesc || null,
  //         rollCall: doc.rollCall || null,
  //         readMore: doc.readMore || null,
  //         date: doc.date || null,
  //         sbaPosition: doc.sbaPosition || null,
  //       };

  //     const getHouseDetails = (sourceData, isHistorical = false) => ({
  //       _id: houseDocument._id,
  //       name: sourceData.name || houseDocument.name,
  //       repId: sourceData.repId || houseDocument.repId,
  //       district: sourceData.district || houseDocument.district,
  //       party: sourceData.party || houseDocument.party,
  //       photo: sourceData.photo || houseDocument.photo,
  //       status: sourceData.status || houseDocument.status,
  //       isNewRecord: sourceData.isNewRecord || houseDocument.isNewRecord,
  //       publishStatus: isHistorical ? "published" : houseDocument.publishStatus,
  //       createdAt: houseDocument.createdAt,
  //       updatedAt: isHistorical
  //         ? latestHistory?.timestamp
  //         : houseDocument.updatedAt,
  //     });

  //     /* =========================
  //      HELPERS: CONGRESS LOGIC
  //   ========================== */
  //     const getLatestCongressNumber = (terms) => {
  //       let maxCongress = -Infinity;
  //       terms.forEach((t) => {
  //         (t?.termId?.congresses || []).forEach((c) => {
  //           if (c > maxCongress) maxCongress = c;
  //         });
  //       });
  //       return maxCongress;
  //     };
  //     const getMaxCongressOfTerm = (term) => {
  //       const congresses = term?.termId?.congresses || [];
  //       return congresses.length ? Math.max(...congresses) : -Infinity;
  //     };

  //     const splitByLatestCongress = (terms) => {
  //       const latestCongress = getLatestCongressNumber(terms);

  //       let currentTerm = null;
  //       let pastTerms = [];

  //       terms.forEach((t) => {
  //         const congresses = t?.termId?.congresses || [];
  //         if (congresses.includes(latestCongress)) {
  //           currentTerm = t;
  //         } else {
  //           pastTerms.push(t);
  //         }
  //       });

  //       // 🔽 SORT past terms by congress DESC
  //       pastTerms.sort(
  //         (a, b) => getMaxCongressOfTerm(b) - getMaxCongressOfTerm(a),
  //       );

  //       return { currentTerm, pastTerms };
  //     };

  //     let finalCurrentTerm = null;
  //     let finalPastTerms = [];
  //     let houseDetails = null;

  //     /* =========================
  //      HISTORICAL DATA FLOW
  //   ========================== */
  //     if (hasHistoricalData) {
  //       houseDetails = getHouseDetails(latestHistory.oldData, true);

  //       const historicalTerms = latestHistory.oldData.representativeData;

  //       const allTermIds = historicalTerms.map((t) => t.termId);
  //       const allVoteIds = historicalTerms.flatMap((t) =>
  //         (t.votesScore || []).map((v) => v.voteId),
  //       );
  //       const allActivityIds = historicalTerms.flatMap((t) =>
  //         (t.activitiesScore || []).map((a) => a.activityId),
  //       );

  //       const [termDocs, voteDocs, activityDocs] = await Promise.all([
  //         Term.find({ _id: { $in: allTermIds } }).lean(),
  //         Vote.find({ _id: { $in: allVoteIds } }).lean(),
  //         Activity.find({ _id: { $in: allActivityIds } }).lean(),
  //       ]);

  //       const termMap = Object.fromEntries(
  //         termDocs.map((d) => [String(d._id), d]),
  //       );
  //       const voteMap = Object.fromEntries(
  //         voteDocs.map((d) => [String(d._id), cleanVoteOrActivity(d)]),
  //       );
  //       const activityMap = Object.fromEntries(
  //         activityDocs.map((d) => [String(d._id), cleanVoteOrActivity(d)]),
  //       );

  //       const populatedTerms = historicalTerms.map((term) => ({
  //         _id: term._id,
  //         termId: termMap[String(term.termId)] || null,
  //         summary: term.summary,
  //         rating: term.rating,
  //         votesScore: (term.votesScore || []).map((v) => ({
  //           score: v.score,
  //           voteId: voteMap[String(v.voteId)] || null,
  //         })),
  //         activitiesScore: (term.activitiesScore || []).map((a) => ({
  //           score: a.score,
  //           activityId: activityMap[String(a.activityId)] || null,
  //         })),
  //       }));

  //       const { currentTerm, pastTerms } =
  //         splitByLatestCongress(populatedTerms);

  //       finalCurrentTerm = currentTerm;
  //       finalPastTerms = pastTerms;
  //     } else {
  //       /* =========================
  //      CURRENT DATA FLOW
  //   ========================== */
  //       houseDetails = getHouseDetails(houseDocument, false);

  //       const allTerms = await HouseData.find({ houseId })
  //         .populate("termId", "_id name startYear endYear congresses")
  //         .populate(
  //           "votesScore.voteId",
  //           "_id title shortDesc longDesc rollCall readMore date sbaPosition",
  //         )
  //         .populate(
  //           "activitiesScore.activityId",
  //           "_id title shortDesc longDesc rollCall readMore date",
  //         )
  //         .sort({ "termId.startYear": -1, createdAt: -1 })
  //         .lean();

  //       const formatTermData = (term) => ({
  //         _id: term._id,
  //         termId: term.termId,
  //         summary: term.summary,
  //         rating: term.rating,
  //         votesScore: (term.votesScore || []).map((v) => ({
  //           score: v.score,
  //           voteId: cleanVoteOrActivity(v.voteId),
  //         })),
  //         activitiesScore: (term.activitiesScore || []).map((a) => ({
  //           score: a.score,
  //           activityId: cleanVoteOrActivity(a.activityId),
  //         })),
  //       });

  //       const formattedTerms = allTerms.map(formatTermData);

  //       const { currentTerm, pastTerms } =
  //         splitByLatestCongress(formattedTerms);

  //       finalCurrentTerm = currentTerm;
  //       finalPastTerms = pastTerms;
  //     }

  //     return res.status(200).json({
  //       message: "Retrieved successfully",
  //       house: houseDetails,
  //       currentTerm: finalCurrentTerm,
  //       pastTerms: finalPastTerms,
  //       dataSource: hasHistoricalData ? "historical" : "current",
  //       hasHistoricalData,
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving house data:", error);
  //     return res.status(500).json({
  //       message: "Error retrieving house data",
  //       error: error.message,
  //     });
  //   }
  // }

  //new updated HouseDataByHouseId method to get house data by repId

  static async HouseDataByHouseId(req, res) {
    try {
      const houseId = req.params.repId;

      // Get main house document
      const houseDocument = await House.findById(houseId).lean();
      if (!houseDocument) {
        return res.status(404).json({ message: "House data not found" });
      }

      const latestHistory = houseDocument.history?.slice(-1)[0];
      const hasHistoricalData =
        latestHistory?.oldData?.representativeData?.length > 0;

      const cleanVoteOrActivity = (doc) =>
        doc && {
          _id: doc._id,
          title: doc.title || null,
          shortDesc: doc.shortDesc || null,
          longDesc: doc.longDesc || null,
          rollCall: doc.rollCall || null,
          readMore: doc.readMore || null,
          date: doc.date || null,
          sbaPosition: doc.sbaPosition || null,
        };

      const getHouseDetails = (sourceData, isHistorical = false) => ({
        _id: houseDocument._id,
        name: sourceData.name || houseDocument.name,
        repId: sourceData.repId || houseDocument.repId,
        district: sourceData.district || houseDocument.district,
        party: sourceData.party || houseDocument.party,
        photo: sourceData.photo || houseDocument.photo,
        status: sourceData.status || houseDocument.status,
        isNewRecord: sourceData.isNewRecord || houseDocument.isNewRecord,
        publishStatus: isHistorical ? "published" : houseDocument.publishStatus,
        createdAt: houseDocument.createdAt,
        updatedAt: isHistorical
          ? latestHistory?.timestamp
          : houseDocument.updatedAt,
      });

      /* =========================
       HELPERS: CONGRESS LOGIC
    ========================== */
      const getLatestCongressNumber = (terms) => {
        let maxCongress = -Infinity;
        terms.forEach((t) => {
          (t?.termId?.congresses || []).forEach((c) => {
            if (c > maxCongress) maxCongress = c;
          });
        });
        return maxCongress;
      };
      const getMaxCongressOfTerm = (term) => {
        const congresses = term?.termId?.congresses || [];
        return congresses.length ? Math.max(...congresses) : -Infinity;
      };

      const splitByLatestCongress = (terms) => {
        const latestCongress = getLatestCongressNumber(terms);

        let currentTerm = null;
        let pastTerms = [];

        terms.forEach((t) => {
          const congresses = t?.termId?.congresses || [];
          if (congresses.includes(latestCongress)) {
            currentTerm = t;
          } else {
            pastTerms.push(t);
          }
        });

        // 🔽 SORT past terms by congress DESC
        pastTerms.sort(
          (a, b) => getMaxCongressOfTerm(b) - getMaxCongressOfTerm(a),
        );

        return { currentTerm, pastTerms };
      };

      let finalCurrentTerm = null;
      let finalPastTerms = [];
      let houseDetails = null;

      /* =========================
       HISTORICAL DATA FLOW
    ========================== */
      if (hasHistoricalData) {
        houseDetails = getHouseDetails(latestHistory.oldData, true);

        const historicalTerms = latestHistory.oldData.representativeData;

        const allTermIds = historicalTerms.map((t) => t.termId);
        const allVoteIds = historicalTerms.flatMap((t) =>
          (t.votesScore || []).map((v) => v.voteId),
        );
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
          summary: term.summary,
          rating: term.rating,
          votesScore: (term.votesScore || []).map((v) => ({
            score: v.score,
            voteId: voteMap[String(v.voteId)] || null,
          })),
          activitiesScore: (term.activitiesScore || []).map((a) => ({
            score: a.score,
            activityId: activityMap[String(a.activityId)] || null,
          })),
        }));

        // ADDED: Sort votes and activities by date in ascending order
        populatedTerms.forEach((term) => {
          // Sort votes by date ascending
          if (term.votesScore && term.votesScore.length > 0) {
            term.votesScore.sort((a, b) => {
              const dateA = a.voteId?.date
                ? new Date(a.voteId.date)
                : new Date(0);
              const dateB = b.voteId?.date
                ? new Date(b.voteId.date)
                : new Date(0);
              return dateA - dateB;
            });
          }

          // Sort activities by date ascending
          if (term.activitiesScore && term.activitiesScore.length > 0) {
            term.activitiesScore.sort((a, b) => {
              const dateA = a.activityId?.date
                ? new Date(a.activityId.date)
                : new Date(0);
              const dateB = b.activityId?.date
                ? new Date(b.activityId.date)
                : new Date(0);
              return dateA - dateB;
            });
          }
        });

        const { currentTerm, pastTerms } =
          splitByLatestCongress(populatedTerms);

        finalCurrentTerm = currentTerm;
        finalPastTerms = pastTerms;
      } else {
        /* =========================
       CURRENT DATA FLOW
      ========================== */
        houseDetails = getHouseDetails(houseDocument, false);

        const allTerms = await HouseData.find({ houseId })
          .populate("termId", "_id name startYear endYear congresses")
          .populate(
            "votesScore.voteId",
            "_id title shortDesc longDesc rollCall readMore date sbaPosition",
          )
          .populate(
            "activitiesScore.activityId",
            "_id title shortDesc longDesc rollCall readMore date",
          )
          .sort({ "termId.startYear": -1, createdAt: -1 })
          .lean();

        const formatTermData = (term) => ({
          _id: term._id,
          termId: term.termId,
          summary: term.summary,
          rating: term.rating,
          votesScore: (term.votesScore || []).map((v) => ({
            score: v.score,
            voteId: cleanVoteOrActivity(v.voteId),
          })),
          activitiesScore: (term.activitiesScore || []).map((a) => ({
            score: a.score,
            activityId: cleanVoteOrActivity(a.activityId),
          })),
        });

        const formattedTerms = allTerms.map(formatTermData);

        // ADDED: Sort votes and activities by date in ascending order
        formattedTerms.forEach((term) => {
          // Sort votes by date ascending
          if (term.votesScore && term.votesScore.length > 0) {
            term.votesScore.sort((a, b) => {
              const dateA = a.voteId?.date
                ? new Date(a.voteId.date)
                : new Date(0);
              const dateB = b.voteId?.date
                ? new Date(b.voteId.date)
                : new Date(0);
              return dateA - dateB;
            });
          }

          // Sort activities by date ascending
          if (term.activitiesScore && term.activitiesScore.length > 0) {
            term.activitiesScore.sort((a, b) => {
              const dateA = a.activityId?.date
                ? new Date(a.activityId.date)
                : new Date(0);
              const dateB = b.activityId?.date
                ? new Date(b.activityId.date)
                : new Date(0);
              return dateA - dateB;
            });
          }
        });

        const { currentTerm, pastTerms } =
          splitByLatestCongress(formattedTerms);

        finalCurrentTerm = currentTerm;
        finalPastTerms = pastTerms;
      }

      return res.status(200).json({
        message: "Retrieved successfully",
        house: houseDetails,
        currentTerm: finalCurrentTerm,
        pastTerms: finalPastTerms,
        dataSource: hasHistoricalData ? "historical" : "current",
        hasHistoricalData,
      });
    } catch (error) {
      console.error("Error retrieving house data:", error);
      return res.status(500).json({
        message: "Error retrieving house data",
        error: error.message,
      });
    }
  }

  static async updateScores(req, res) {
    try {
      // Handle both formats: { updates: [...] } or just the array
      let updates;
      if (req.body.updates !== undefined) {
        updates = req.body.updates;
      } else if (Array.isArray(req.body)) {
        updates = req.body;
      } else {
        // Try to see if it's a single update object
        if (req.body.houseId || req.body.repId) {
          updates = [req.body];
        } else {
          return res.status(400).json({
            message:
              "Invalid request format. Expected { updates: [...] } or an array of updates",
            received: req.body,
          });
        }
      }

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          message: "Updates must be a non-empty array",
        });
      }

      const results = [];
      const errors = [];
      let globalNotFoundError = null;

      // First, validate that we have a valid voteId or activityId across all updates
      let commonVoteId = null;
      let commonActivityId = null;
      let category = null;

      // Determine the category and validate consistency across all updates
      for (const update of updates) {
        const { votesScore, activitiesScore } = update;

        if (votesScore && Array.isArray(votesScore) && votesScore.length > 0) {
          if (!category) category = "vote";
          if (category !== "vote") {
            return res.status(400).json({
              message:
                "Mixed categories in bulk update. All updates must be either votes or activities.",
            });
          }
          const voteId = votesScore[0].voteId;
          if (commonVoteId === null) commonVoteId = voteId;
          else if (commonVoteId.toString() !== voteId.toString()) {
            return res.status(400).json({
              message:
                "Multiple voteIds in bulk update. All updates must target the same vote.",
            });
          }
        } else if (
          activitiesScore &&
          Array.isArray(activitiesScore) &&
          activitiesScore.length > 0
        ) {
          if (!category) category = "activity";
          if (category !== "activity") {
            return res.status(400).json({
              message:
                "Mixed categories in bulk update. All updates must be either votes or activities.",
            });
          }
          const activityId = activitiesScore[0].activityId;
          if (commonActivityId === null) commonActivityId = activityId;
          else if (commonActivityId.toString() !== activityId.toString()) {
            return res.status(400).json({
              message:
                "Multiple activityIds in bulk update. All updates must target the same activity.",
            });
          }
        } else {
          return res.status(400).json({
            message:
              "Each update must contain either votesScore or activitiesScore array",
            update,
          });
        }
      }

      // Check if at least one representative has the item
      let atLeastOneHasItem = false;
      const itemsToCheck = [];

      // First pass: check which houses have the item
      for (const update of updates) {
        try {
          const { repId, houseId } = update;

          // Validate that we have either repId or houseId
          if (!repId && !houseId) {
            errors.push({
              update,
              error: "Either repId or houseId is required",
            });
            continue;
          }

          // Find the representative to get houseId if only repId is provided
          let targetHouseId = houseId;
          if (!targetHouseId && repId) {
            const representative = await House.findOne({ repId }).lean();
            if (!representative) {
              errors.push({
                update,
                error: `Representative not found with repId: ${repId}`,
              });
              continue;
            }
            targetHouseId = representative._id;
          }

          // Convert houseId to ObjectId if it's a string
          const houseObjectId =
            typeof targetHouseId === "string"
              ? new mongoose.Types.ObjectId(targetHouseId)
              : targetHouseId;

          itemsToCheck.push({
            houseObjectId,
            update,
          });
        } catch (error) {
          errors.push({
            update,
            error: error.message,
            stack:
              process.env.NODE_ENV === "development" ? error.stack : undefined,
          });
        }
      }

      // Check each house to see if they have the item
      for (const item of itemsToCheck) {
        const { houseObjectId, update } = item;

        // Find all RepresentativeData documents for this house
        const houseDataList = await HouseData.find({ houseId: houseObjectId });

        if (houseDataList.length === 0) {
          continue; // Skip, will be handled in second pass
        }

        let itemFound = false;

        if (category === "vote" && commonVoteId) {
          // Convert voteId to ObjectId
          const voteObjectId =
            typeof commonVoteId === "string"
              ? new mongoose.Types.ObjectId(commonVoteId)
              : commonVoteId;

          // Check if any houseData has this vote
          for (const houseData of houseDataList) {
            const existingVoteIndex = houseData.votesScore.findIndex(
              (v) =>
                v.voteId && v.voteId.toString() === voteObjectId.toString(),
            );

            if (existingVoteIndex >= 0) {
              itemFound = true;
              atLeastOneHasItem = true;
              break;
            }
          }
        } else if (category === "activity" && commonActivityId) {
          // Convert activityId to ObjectId
          const activityObjectId =
            typeof commonActivityId === "string"
              ? new mongoose.Types.ObjectId(commonActivityId)
              : commonActivityId;

          // Check if any houseData has this activity
          for (const houseData of houseDataList) {
            const existingActivityIndex = houseData.activitiesScore.findIndex(
              (a) =>
                a.activityId &&
                a.activityId.toString() === activityObjectId.toString(),
            );

            if (existingActivityIndex >= 0) {
              itemFound = true;
              atLeastOneHasItem = true;
              break;
            }
          }
        }

        if (!itemFound) {
        }
      }

      // Second pass: perform the actual updates
      for (const update of updates) {
        try {
          const { repId, houseId, votesScore, activitiesScore } = update;

          // Skip if already in errors from first pass
          const alreadyErrored = errors.some(
            (err) =>
              err.update === update ||
              (err.update &&
                err.update.houseId === houseId &&
                err.update.repId === repId),
          );

          if (alreadyErrored) {
            continue;
          }

          // Find the representative to get houseId if only repId is provided
          let targetHouseId = houseId;
          if (!targetHouseId && repId) {
            const representative = await House.findOne({ repId }).lean();
            if (!representative) {
              errors.push({
                update,
                error: `Representative not found with repId: ${repId}`,
              });
              continue;
            }
            targetHouseId = representative._id;
          }

          // Convert houseId to ObjectId if it's a string
          const houseObjectId =
            typeof targetHouseId === "string"
              ? new mongoose.Types.ObjectId(targetHouseId)
              : targetHouseId;

          // Find all RepresentativeData documents for this house
          const houseDataList = await HouseData.find({
            houseId: houseObjectId,
          });

          if (houseDataList.length === 0) {
            errors.push({
              update,
              error: `No RepresentativeData found for houseId: ${houseObjectId}`,
            });
            continue;
          }

          const voteUpdates = [];
          const activityUpdates = [];
          const notFoundItems = [];
          let itemFoundForThisHouse = false;
          let scoreToUpdate = null;

          // Get the score from the update
          if (category === "vote" && votesScore && votesScore[0]) {
            scoreToUpdate = votesScore[0].score;
          } else if (
            category === "activity" &&
            activitiesScore &&
            activitiesScore[0]
          ) {
            scoreToUpdate = activitiesScore[0].score;
          }

          if (!scoreToUpdate) {
            errors.push({
              update,
              error: "Score is required for update",
            });
            continue;
          }

          // Process votesScore updates or assignments
          if (category === "vote" && commonVoteId) {
            // Convert voteId to ObjectId if it's a string
            const voteObjectId =
              typeof commonVoteId === "string"
                ? new mongoose.Types.ObjectId(commonVoteId)
                : commonVoteId;

            // Find which RepresentativeData document contains this voteId
            for (const houseData of houseDataList) {
              const existingVoteIndex = houseData.votesScore.findIndex(
                (v) =>
                  v.voteId && v.voteId.toString() === voteObjectId.toString(),
              );

              if (existingVoteIndex >= 0) {
                // Found the vote, capture old score before updating
                const oldScore = houseData.votesScore[existingVoteIndex].score;
                houseData.votesScore[existingVoteIndex].score = scoreToUpdate;
                voteUpdates.push({
                  voteId: commonVoteId,
                  houseDataId: houseData._id,
                  termId: houseData.termId,
                  oldScore: oldScore,
                  newScore: scoreToUpdate,
                  action: "updated",
                });
                itemFoundForThisHouse = true;
                break; // Vote found, no need to check other documents
              }
            }

            // If vote not found, check if vote date belongs to any existing term
            if (!itemFoundForThisHouse) {
              // Extract vote date from the vote object itself (not from votesScore)
              let voteDate = null;
              let voteYear = null;

              // Try to get the vote object to extract its date
              if (commonVoteId) {
                const voteObjectId =
                  typeof commonVoteId === "string"
                    ? new mongoose.Types.ObjectId(commonVoteId)
                    : commonVoteId;
                const voteObj = await Vote.findById(voteObjectId).lean();
                if (voteObj && voteObj.date) {
                  voteDate = voteObj.date;
                  voteYear = new Date(voteDate).getFullYear();
                }
              }

              let targetTermId = null;
              let targetHouseData = null;

              if (voteYear) {
                // Find all terms and filter for VALID terms only
                const allTerms = await Term.find().lean();
                const validTerms = allTerms.filter(isValidTerm);

                // Find VALID term where voteYear falls within startYear and endYear
                for (const term of validTerms) {
                  if (term.startYear && term.endYear) {
                    if (
                      voteYear >= term.startYear &&
                      voteYear <= term.endYear
                    ) {
                      targetTermId = term._id;
                      // Try to find or create HouseData for this term
                      targetHouseData = await HouseData.findOne({
                        houseId: houseObjectId,
                        termId: targetTermId,
                      });
                      if (!targetHouseData) {
                        // Create new HouseData for this term
                        targetHouseData = new HouseData({
                          houseId: houseObjectId,
                          termId: targetTermId,
                          votesScore: [],
                          activitiesScore: [],
                        });
                      } else {
                        console.log(
                          `   Found existing HouseData for term ${term.name}`,
                        );
                      }
                      break;
                    }
                  }
                }
              }

              // If no matching VALID term found, create new valid term (odd-even format)
              if (!targetTermId && voteYear) {
                // Create term with proper odd-even year range (e.g., 2021-2022)
                const startYear = voteYear % 2 === 1 ? voteYear : voteYear - 1; // Make it odd
                const endYear = startYear + 1; // Make it even

                const newTerm = new Term({
                  startYear: startYear,
                  endYear: endYear,
                  name: `${startYear}-${endYear}`,
                  congresses: getCongresses(startYear, endYear),
                });
                await newTerm.save();
                targetTermId = newTerm._id;
                targetHouseData = new HouseData({
                  houseId: houseObjectId,
                  termId: targetTermId,
                  votesScore: [],
                  activitiesScore: [],
                });
              }

              // Double-check: ensure vote doesn't already exist (prevent duplicates)
              const voteAlreadyExists = targetHouseData.votesScore.some(
                (v) =>
                  v.voteId && v.voteId.toString() === voteObjectId.toString(),
              );

              if (!voteAlreadyExists) {
                // Add new vote to votesScore array
                targetHouseData.votesScore.push({
                  voteId: voteObjectId,
                  score: scoreToUpdate,
                });

                // Save the HouseData
                await targetHouseData.save();

                voteUpdates.push({
                  voteId: commonVoteId,
                  houseDataId: targetHouseData._id,
                  termId: targetTermId,
                  oldScore: null,
                  newScore: scoreToUpdate,
                  action: "assigned",
                });
                itemFoundForThisHouse = true;
              } else {
                console.log(
                  `Vote ${commonVoteId} already exists in house ${houseObjectId}. Skipping duplicate.`,
                );
              }
            }
          }

          // Process activitiesScore updates or assignments
          if (category === "activity" && commonActivityId) {
            // Convert activityId to ObjectId if it's a string
            const activityObjectId =
              typeof commonActivityId === "string"
                ? new mongoose.Types.ObjectId(commonActivityId)
                : commonActivityId;

            // Find which RepresentativeData document contains this activityId
            for (const houseData of houseDataList) {
              const existingActivityIndex = houseData.activitiesScore.findIndex(
                (a) =>
                  a.activityId &&
                  a.activityId.toString() === activityObjectId.toString(),
              );

              if (existingActivityIndex >= 0) {
                // Found the activity, capture old score before updating
                const oldScore =
                  houseData.activitiesScore[existingActivityIndex].score;
                houseData.activitiesScore[existingActivityIndex].score =
                  scoreToUpdate;
                activityUpdates.push({
                  activityId: commonActivityId,
                  houseDataId: houseData._id,
                  termId: houseData.termId,
                  oldScore: oldScore,
                  newScore: scoreToUpdate,
                  action: "updated",
                });
                itemFoundForThisHouse = true;
                break; // Activity found, no need to check other documents
              }
            }

            // If activity not found, check if activity date belongs to any existing term
            if (!itemFoundForThisHouse) {
              // Extract activity date from the activity object itself
              let activityDate = null;
              let activityYear = null;

              // Try to get the activity object to extract its date
              if (commonActivityId) {
                const activityObjectId =
                  typeof commonActivityId === "string"
                    ? new mongoose.Types.ObjectId(commonActivityId)
                    : commonActivityId;
                const activityObj =
                  await Activity.findById(activityObjectId).lean();
                if (activityObj && activityObj.date) {
                  activityDate = activityObj.date;
                  activityYear = new Date(activityDate).getFullYear();
                }
              }
              let targetTermId = null;
              let targetHouseData = null;

              if (activityYear) {
                // Find all terms and filter for VALID terms only
                const allTerms = await Term.find().lean();
                const validTerms = allTerms.filter(isValidTerm);
                // Find VALID term where activityYear falls within startYear and endYear
                for (const term of validTerms) {
                  if (term.startYear && term.endYear) {
                    if (
                      activityYear >= term.startYear &&
                      activityYear <= term.endYear
                    ) {
                      targetTermId = term._id;
                      // Try to find or create HouseData for this term
                      targetHouseData = await HouseData.findOne({
                        houseId: houseObjectId,
                        termId: targetTermId,
                      });
                      if (!targetHouseData) {
                        // Create new HouseData for this term
                        targetHouseData = new HouseData({
                          houseId: houseObjectId,
                          termId: targetTermId,
                          votesScore: [],
                          activitiesScore: [],
                        });
                      } else {
                        console.log(
                          `   Found existing HouseData for term ${term.name}`,
                        );
                      }
                      break;
                    }
                  }
                }
              }

              // If no matching VALID term found, create new valid term (odd-even format)
              if (!targetTermId && activityYear) {
                // Create term with proper odd-even year range (e.g., 2021-2022)
                const startYear =
                  activityYear % 2 === 1 ? activityYear : activityYear - 1; // Make it odd
                const endYear = startYear + 1; // Make it even

                const newTerm = new Term({
                  startYear: startYear,
                  endYear: endYear,
                  name: `${startYear}-${endYear}`,
                  congresses: getCongresses(startYear, endYear),
                });
                await newTerm.save();
                targetTermId = newTerm._id;

                targetHouseData = new HouseData({
                  houseId: houseObjectId,
                  termId: targetTermId,
                  votesScore: [],
                  activitiesScore: [],
                });
              }

              // Double-check: ensure activity doesn't already exist (prevent duplicates)
              const activityAlreadyExists =
                targetHouseData.activitiesScore.some(
                  (a) =>
                    a.activityId &&
                    a.activityId.toString() === activityObjectId.toString(),
                );

              if (!activityAlreadyExists) {
                // Add new activity to activitiesScore array
                targetHouseData.activitiesScore.push({
                  activityId: activityObjectId,
                  score: scoreToUpdate,
                });

                // Save the HouseData
                await targetHouseData.save();

                activityUpdates.push({
                  activityId: commonActivityId,
                  houseDataId: targetHouseData._id,
                  termId: targetTermId,
                  oldScore: null,
                  newScore: scoreToUpdate,
                  action: "assigned",
                });
                itemFoundForThisHouse = true;
              } else {
                console.log(
                  `Activity ${commonActivityId} already exists in house ${houseObjectId}. Skipping duplicate.`,
                );
              }
            }
          }

          // Save all modified RepresentativeData documents (for updated items, not newly assigned)
          const savedDocuments = [];
          if (itemFoundForThisHouse) {
            // Only save documents that were found and updated (not newly assigned, as those are already saved)
            for (const houseData of houseDataList) {
              // Check if this document was modified (only for updates, not assignments)
              const wasModified =
                voteUpdates.some(
                  (u) =>
                    u.houseDataId.toString() === houseData._id.toString() &&
                    u.action === "updated",
                ) ||
                activityUpdates.some(
                  (u) =>
                    u.houseDataId.toString() === houseData._id.toString() &&
                    u.action === "updated",
                );

              if (wasModified) {
                await houseData.save();
                savedDocuments.push({
                  houseDataId: houseData._id,
                  termId: houseData.termId,
                });
              }
            }

            results.push({
              repId: repId || null,
              houseId: houseObjectId,
              voteUpdates: voteUpdates.length,
              activityUpdates: activityUpdates.length,
              notFound: notFoundItems.length,
              savedDocuments: savedDocuments.length,
              details: {
                votesUpdated: voteUpdates,
                activitiesUpdated: activityUpdates,
                notFoundItems:
                  notFoundItems.length > 0 ? notFoundItems : undefined,
              },
              success: true,
            });
          } else {
            // This house doesn't have the item, but we can still assign it
            errors.push({
              update,
              error: `Unable to process ${category} for this representative. No RepresentativeData documents available.`,
              houseId: houseObjectId,
              itemId: category === "vote" ? commonVoteId : commonActivityId,
            });
          }
        } catch (error) {
          console.error(`Error processing update:`, error);
          errors.push({
            update,
            error: error.message,
            stack:
              process.env.NODE_ENV === "development" ? error.stack : undefined,
          });
        }
      }

      const response = {
        message: "Score updates completed",
        totalUpdates: updates.length,
        successful: results.length,
        failed: errors.length,
        results,
        category,
        itemId: category === "vote" ? commonVoteId : commonActivityId,
      };

      if (errors.length > 0) {
        response.errors = errors;
      }

      // Return 200 if at least some updates succeeded, 400 if all failed
      const statusCode = results.length > 0 ? 200 : 400;
      return res.status(statusCode).json(response);
    } catch (error) {
      console.error("Error updating scores:", error);
      return res.status(500).json({
        message: "Error updating scores",
        error: error.message,
      });
    }
  }

  static async bulkPublish(req, res) {
    try {
      const { houseIds } = req.body;

      if (!Array.isArray(houseIds) || houseIds.length === 0) {
        return res.status(400).json({
          message: "houseIds array is required and must not be empty",
        });
      }

      const results = [];
      const errors = [];
      let successCount = 0;

      for (const houseId of houseIds) {
        try {
          // Validate houseId
          if (!mongoose.Types.ObjectId.isValid(houseId)) {
            errors.push({
              houseId,
              message: "Invalid houseId format",
            });
            continue;
          }
          // Step 1: Get the representative
          const house = await House.findById(houseId);
          if (!house) {
            errors.push({
              houseId,
              message: "Representative not found",
            });
            continue;
          }

          // Get all terms and filter valid ones
          const allTerms = await Term.find().sort({ startYear: -1 }).lean();
          const validTerms = allTerms.filter(isValidTerm);

          // Fetch all HouseData for this house - WITHOUT lean() so we get Mongoose documents
          const houseData = await HouseData.find({ houseId })
            .sort({ createdAt: 1 })
            .populate({
              path: "houseId",
              select: "-history",
            })
            .populate({
              path: "votesScore.voteId",
              populate: { path: "termId" },
            })
            .populate("activitiesScore.activityId");
          // Removed .lean() here

          if (!houseData.length) {
            errors.push({
              houseId,
              message: "No house data records",
            });
            continue;
          }

          // Step 2: Process votes and activities
          // Flatten all votes and activities
          const allVotes = houseData.flatMap((hd) => hd.votesScore || []);
          const allActivities = houseData.flatMap(
            (hd) => hd.activitiesScore || [],
          );

          // Build indexes for quick congress lookup
          const votesByCongress = new Map();
          const activitiesByCongress = new Map();

          // Group votes by congress
          for (const vote of allVotes) {
            const congress = Number(vote.voteId?.congress);
            if (!congress) continue;
            if (!votesByCongress.has(congress))
              votesByCongress.set(congress, []);
            votesByCongress.get(congress).push(vote);
          }

          // Group activities by congress
          for (const activity of allActivities) {
            const congress = Number(activity.activityId?.congress);
            if (!congress) continue;
            if (!activitiesByCongress.has(congress))
              activitiesByCongress.set(congress, []);
            activitiesByCongress.get(congress).push(activity);
          }

          // Create termId to HouseData mapping
          const termIdToHouseData = new Map();
          for (const hd of houseData) {
            if (hd.termId) {
              termIdToHouseData.set(hd.termId.toString(), hd);
            }
          }

          // Step 3: Process each term and assign correct votes/activities
          let processedTerms = 0;
          let reassignedVotes = 0;
          let reassignedActivities = 0;
          let removedDuplicatesVotes = 0;
          let removedDuplicatesActivities = 0;

          // Track all votes and activities we've assigned to prevent duplicates
          const assignedVotes = new Map();
          const assignedActivities = new Map(); // activityId -> termId it's assigned to

          // First, create a map to track which votes/activities should go to which term based on congress
          const votesByTerm = new Map();
          const activitiesByTerm = new Map();

          for (const term of validTerms) {
            const termCongresses = term.congresses || [];
            if (termCongresses.length !== 1) {
              continue;
            }

            const singleCongress = termCongresses[0];
            const termIdStr = term._id.toString();

            // Get votes and activities for this congress
            const votesForCongress = votesByCongress.get(singleCongress) || [];
            const activitiesForCongress =
              activitiesByCongress.get(singleCongress) || [];

            // Filter to get unique votes for this congress
            const uniqueVotesForTerm = [];
            const seenVoteIds = new Set();

            for (const vote of votesForCongress) {
              const voteId =
                vote.voteId?._id?.toString() || vote.voteId?.toString();
              if (voteId && !seenVoteIds.has(voteId)) {
                seenVoteIds.add(voteId);
                uniqueVotesForTerm.push(vote);
              }
            }

            // Filter to get unique activities for this congress
            const uniqueActivitiesForTerm = [];
            const seenActivityIds = new Set();

            for (const activity of activitiesForCongress) {
              const activityId =
                activity.activityId?._id?.toString() ||
                activity.activityId?.toString();
              if (activityId && !seenActivityIds.has(activityId)) {
                seenActivityIds.add(activityId);
                uniqueActivitiesForTerm.push(activity);
              }
            }

            votesByTerm.set(termIdStr, uniqueVotesForTerm);
            activitiesByTerm.set(termIdStr, uniqueActivitiesForTerm);
          }

          // Second, process each HouseData document and update with the correct votes/activities
          for (const term of validTerms) {
            const termCongresses = term.congresses || [];
            if (termCongresses.length !== 1) {
              continue;
            }

            const singleCongress = termCongresses[0];
            const termIdStr = term._id.toString();

            // Find or create HouseData for this term
            let houseDataDoc = termIdToHouseData.get(termIdStr);
            let isNewHouseData = false;

            if (!houseDataDoc) {
              houseDataDoc = new HouseData({
                houseId,
                termId: term._id,
                currentTerm: false,
                summary: "",
                rating: "",
                votesScore: [],
                activitiesScore: [],
              });
              isNewHouseData = true;
            }

            // Track original counts
            const originalVotesCount = houseDataDoc.votesScore?.length || 0;
            const originalActivitiesCount =
              houseDataDoc.activitiesScore?.length || 0;

            // Get the correct votes and activities for this term
            const correctVotes = votesByTerm.get(termIdStr) || [];
            const correctActivities = activitiesByTerm.get(termIdStr) || [];

            // Update HouseData with correct votes and activities
            houseDataDoc.votesScore = correctVotes;
            houseDataDoc.activitiesScore = correctActivities;

            // Track reassignments
            reassignedVotes += correctVotes.length - originalVotesCount;
            reassignedActivities +=
              correctActivities.length - originalActivitiesCount;

            // Track assigned votes and activities
            for (const vote of correctVotes) {
              const voteId =
                vote.voteId?._id?.toString() || vote.voteId?.toString();
              if (voteId) {
                assignedVotes.set(voteId, termIdStr);
              }
            }

            for (const activity of correctActivities) {
              const activityId =
                activity.activityId?._id?.toString() ||
                activity.activityId?.toString();
              if (activityId) {
                assignedActivities.set(activityId, termIdStr);
              }
            }

            // Save the HouseData document
            if (
              isNewHouseData ||
              houseDataDoc.votesScore.length !== originalVotesCount ||
              houseDataDoc.activitiesScore.length !== originalActivitiesCount
            ) {
              await houseDataDoc.save();
              processedTerms++;
            }
          }

          // Third, clean up any remaining duplicates in HouseData documents that might have been missed
          const allUpdatedHouseData = await HouseData.find({ houseId });
          for (const hd of allUpdatedHouseData) {
            const termIdStr = hd.termId?.toString();

            if (!termIdStr) continue;

            // Clean duplicate votes
            if (hd.votesScore && hd.votesScore.length > 0) {
              const uniqueVotes = [];
              const seenVoteIds = new Set();
              let duplicatesRemoved = 0;

              for (const vote of hd.votesScore) {
                const voteId =
                  vote.voteId?._id?.toString() || vote.voteId?.toString();
                if (
                  voteId &&
                  !seenVoteIds.has(voteId) &&
                  assignedVotes.get(voteId) === termIdStr
                ) {
                  seenVoteIds.add(voteId);
                  uniqueVotes.push(vote);
                } else if (voteId && assignedVotes.get(voteId) !== termIdStr) {
                  // This vote belongs to a different term, remove it
                  duplicatesRemoved++;
                }
              }

              if (uniqueVotes.length !== hd.votesScore.length) {
                hd.votesScore = uniqueVotes;
                removedDuplicatesVotes +=
                  hd.votesScore.length - uniqueVotes.length;
                await hd.save();
              }
            }

            // Clean duplicate activities
            if (hd.activitiesScore && hd.activitiesScore.length > 0) {
              const uniqueActivities = [];
              const seenActivityIds = new Set();
              let duplicatesRemoved = 0;

              for (const activity of hd.activitiesScore) {
                const activityId =
                  activity.activityId?._id?.toString() ||
                  activity.activityId?.toString();
                if (
                  activityId &&
                  !seenActivityIds.has(activityId) &&
                  assignedActivities.get(activityId) === termIdStr
                ) {
                  seenActivityIds.add(activityId);
                  uniqueActivities.push(activity);
                } else if (
                  activityId &&
                  assignedActivities.get(activityId) !== termIdStr
                ) {
                  // This activity belongs to a different term, remove it
                  duplicatesRemoved++;
                }
              }

              if (uniqueActivities.length !== hd.activitiesScore.length) {
                hd.activitiesScore = uniqueActivities;
                removedDuplicatesActivities +=
                  hd.activitiesScore.length - uniqueActivities.length;
                await hd.save();
              }
            }
          }
          // Get all HouseData after reassignment
          const updatedHouseData = await HouseData.find({ houseId });
          for (const hd of updatedHouseData) {
            const hasTermId = !!hd.termId;
            const hasVotes = hd.votesScore && hd.votesScore.length > 0;
            const hasActivities =
              hd.activitiesScore && hd.activitiesScore.length > 0;
            const hasContent = hd.summary || hd.rating;

            if (!hasTermId || (!hasVotes && !hasActivities && !hasContent)) {
              await HouseData.findByIdAndDelete(hd._id);
            }
          }
          // Find the most recent term by startYear
          const remainingHouseData = await HouseData.find({ houseId }).populate(
            "termId",
          );
          if (remainingHouseData.length > 0) {
            // Find the most recent term by startYear
            let mostRecentTerm = null;
            let mostRecentYear = 0;

            for (const hd of remainingHouseData) {
              if (hd.termId && hd.termId.startYear > mostRecentYear) {
                mostRecentYear = hd.termId.startYear;
                mostRecentTerm = hd;
              }
            }

            if (mostRecentTerm) {
              // Check if the most recent term is already marked as currentTerm
              if (mostRecentTerm.currentTerm === true) {
              } else {
                // Reset all currentTerm to false
                await HouseData.updateMany(
                  { houseId },
                  { $set: { currentTerm: false } },
                );

                // Set the most recent term as currentTerm
                mostRecentTerm.currentTerm = true;
                await mostRecentTerm.save();
              }
            } else {
              console.log(`   Could not find a valid term to set as current`);
            }
          } else {
            console.log(`   No HouseData records found after cleanup`);
          }
          // Step 6: Publish the representative
          const updatedHouse = await House.findByIdAndUpdate(
            houseId,
            {
              publishStatus: "published",
              editedFields: [],
              fieldEditors: {},
              history: [],
            },
            { new: true },
          );

          results.push({
            houseId,
            representativeName: house.name,
            message: "Published successfully",
            termsProcessed: processedTerms,
            votesReassigned: reassignedVotes,
            activitiesReassigned: reassignedActivities,
            finalRecordsCount: remainingHouseData.length,
            success: true,
          });

          successCount++;
        } catch (err) {
          console.error(`Error processing representative ${houseId}:`, err);
          errors.push({
            houseId,
            message: err.message,
            stack:
              process.env.NODE_ENV === "development" ? err.stack : undefined,
          });
        }
      }

      const response = {
        message: "Bulk publish completed",
        totalRepresentatives: houseIds.length,
        successful: successCount,
        failed: errors.length,
        results,
      };

      if (errors.length > 0) {
        response.errors = errors;
      }

      const statusCode = successCount > 0 ? 200 : 400;
      return res.status(statusCode).json(response);
    } catch (err) {
      console.error("Error in bulkPublish:", err);
      return res.status(500).json({
        message: "Error in bulk publish",
        error: err.message,
      });
    }
  }
}

module.exports = houseDataController;
