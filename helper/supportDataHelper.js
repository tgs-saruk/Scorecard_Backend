const SenatorData = require("../models/senatorDataSchema");
const RepresentativeData = require("../models/representativeDataSchema");

function normalizeName(name) {
  return name.replace(/^(Sen\.|Rep\.)\s*/i, "").trim();
}

async function buildSupportData(doc, isActivity = false) {
  let supportData = isActivity
    ? {
        yes: [],
        no: [],
        other: [],
        participation: {
          totalVotes: 0,
          yesVotes: 0,
          noVotes: 0,
          otherVotes: 0,
          senateCount: 0,
          houseCount: 0,
        },
      }
    : {
        yea: [],
        nay: [],
        present: [],
        missed: [],
        other: [],
        participation: {
          totalVotes: 0,
          yeaVotes: 0,
          nayVotes: 0,
          presentVotes: 0,
          missedVotes: 0,
          otherVotes: 0,
          senateCount: 0,
          houseCount: 0,
        },
      };

  if (!doc) return supportData;

  console.log(
    `[SUPPORT-DATA-START] Building support data for ${isActivity ? "activity" : "vote"} ID: ${doc._id}`,
  );

  try {
    const [senatorDocs, repDocs] = await Promise.all([
      SenatorData.find({
        [isActivity ? "activitiesScore.activityId" : "votesScore.voteId"]:
          doc._id,
      })
        .populate("senateId", "_id name party state photo")
        .lean(),

      RepresentativeData.find({
        [isActivity ? "activitiesScore.activityId" : "votesScore.voteId"]:
          doc._id,
      })
        .populate("houseId", "_id name party district state photo")
        .lean(),
    ]);

    // Senators
    senatorDocs.forEach((senData) => {
      const scoreEntry = (
        isActivity ? senData.activitiesScore : senData.votesScore
      ).find(
        (s) =>
          s[isActivity ? "activityId" : "voteId"]?.toString() ===
          doc._id.toString(),
      );

      if (scoreEntry && senData.senateId) {
        const info = {
          _id: senData.senateId._id,
          name: normalizeName(senData.senateId.name),
          party: senData.senateId.party,
          state: senData.senateId.state,
          photo: senData.senateId.photo,
          chamber: "senate",
        };

        const score = scoreEntry.score?.toLowerCase();
        if (isActivity) {
          if (score === "yes") supportData.yes.push(info);
          else if (score === "no") supportData.no.push(info);
          else if (score === "present") supportData.present.push(info);
          else if (score === "missed") supportData.missed.push(info);
          else supportData.other.push(info);
        } else {
          if (score === "yea") supportData.yea.push(info);
          else if (score === "nay") supportData.nay.push(info);
          else if (score === "present") supportData.present.push(info);
          else if (score === "missed") supportData.missed.push(info);
          else supportData.other.push(info);
        }
      }
    });

    // Representatives
    repDocs.forEach((repData) => {
      const scoreEntry = (
        isActivity ? repData.activitiesScore : repData.votesScore
      ).find(
        (s) =>
          s[isActivity ? "activityId" : "voteId"]?.toString() ===
          doc._id.toString(),
      );

      if (scoreEntry && repData.houseId) {
        const score = scoreEntry.score?.toLowerCase();
        const info = {
          _id: repData.houseId._id,
          name: normalizeName(repData.houseId.name),
          party: repData.houseId.party,
          state: repData.houseId.state,
          district: repData.houseId.district,
          photo: repData.houseId.photo,
          chamber: "house",
        };

        if (isActivity) {
          if (score === "yes") supportData.yes.push(info);
          else if (score === "no") supportData.no.push(info);
          else supportData.other.push(info);
        } else {
          if (score === "yea") supportData.yea.push(info);
          else if (score === "nay") supportData.nay.push(info);
          else if (score === "present") {
            console.log(
              `[DEBUG-PRESENT] Adding present vote for rep: ${info.name || "NO_NAME"}, houseId: ${repData.houseId._id}, raw name from schema: "${repData.houseId.name}"`,
            );
            supportData.present.push(info);
          } else if (score === "missed") supportData.missed.push(info);
          else supportData.other.push(info);
        }
      }
    });
  } catch (error) {
    console.error("Error building support data:", error);
  }

  // Calculate participation
  if (isActivity) {
    supportData.participation = {
      totalVotes:
        supportData.yes.length +
        supportData.no.length +
        supportData.other.length,
      yesVotes: supportData.yes.length,
      noVotes: supportData.no.length,
      otherVotes: supportData.other.length,
      senateCount:
        supportData.yes.filter((m) => m.chamber === "senate").length +
        supportData.no.filter((m) => m.chamber === "senate").length +
        supportData.other.filter((m) => m.chamber === "senate").length,
      houseCount:
        supportData.yes.filter((m) => m.chamber === "house").length +
        supportData.no.filter((m) => m.chamber === "house").length +
        supportData.other.filter((m) => m.chamber === "house").length,
    };
  } else {
    supportData.participation = {
      totalVotes:
        supportData.yea.length +
        supportData.nay.length +
        supportData.present.length +
        supportData.missed.length +
        supportData.other.length,
      yeaVotes: supportData.yea.length,
      nayVotes: supportData.nay.length,
      presentVotes: supportData.present.length,
      missedVotes: supportData.missed.length,
      otherVotes: supportData.other.length,
      senateCount:
        supportData.yea.filter((m) => m.chamber === "senate").length +
        supportData.nay.filter((m) => m.chamber === "senate").length +
        supportData.present.filter((m) => m.chamber === "senate").length +
        supportData.missed.filter((m) => m.chamber === "senate").length +
        supportData.other.filter((m) => m.chamber === "senate").length,
      houseCount:
        supportData.yea.filter((m) => m.chamber === "house").length +
        supportData.nay.filter((m) => m.chamber === "house").length +
        supportData.present.filter((m) => m.chamber === "house").length +
        supportData.missed.filter((m) => m.chamber === "house").length +
        supportData.other.filter((m) => m.chamber === "house").length,
    };
    console.log(
      `[SUPPORT-DATA-FINAL] voteId=${doc._id} present=${supportData.present.length} presentNames=[${supportData.present.map((p) => p.name).join(", ")}]`,
    );
  }

  return supportData;
}

module.exports = { buildSupportData };
