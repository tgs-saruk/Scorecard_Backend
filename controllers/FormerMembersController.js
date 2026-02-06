require("dotenv").config();
const axios = require("axios");
const cacheConfig = require("../config/cache-config");
const Senator = require("../models/senatorSchema");
const Representative = require("../models/representativeSchema");

const apiClient = axios.create({
  timeout: cacheConfig.TIMEOUTS.API_REQUEST,
});

class FormerMembersController {
  constructor(quorumController) {
    this.quorumController = quorumController;
    // Separate cache for former members
    this._formerMembersCache = {
      senator: { data: null, timestamp: 0 },
      representative: { data: null, timestamp: 0 },
    };
    this._CACHE_TTL = {
      senator: cacheConfig.CACHE_TTL.SENATOR || 3600000, // 1 hour
      representative: cacheConfig.CACHE_TTL.REPRESENTATIVE || 3600000,
    };
  }

  // Fetch former members from API (with caching)
  async fetchFormerMembers(type) {
    const cache = this._formerMembersCache[type];
    const now = Date.now();
    const ttl = this._CACHE_TTL[type];

    // Check if cache is still valid
    if (cache?.data && now - cache.timestamp < ttl) {
      return { data: cache.data, fromCache: true };
    }
    let allRoles = [];
    let pageOffset = 0;
    const pageLimit = 100;
    let morePages = true;

    while (morePages) {
      const params = {
        role_type__in: type === "senator" ? "senator" : "representative",
        region: "federal",
        current: false,
        enddate__gte: "2019-01-04",
        limit: pageLimit,
        offset: pageOffset,
        api_key: process.env.QUORUM_API_KEY,
        username: process.env.QUORUM_USERNAME,
      };

      const rolesTask = () =>
        apiClient.get("https://www.quorum.us/api/newpersonrole/", {
          params,
        });

      const rolesResponse = await this.quorumController._requestQueue.add(
        rolesTask
      );
      const roles = rolesResponse.data?.objects || [];

      if (!roles.length) {
        morePages = false;
        break;
      }

      allRoles.push(...roles);
      pageOffset += pageLimit;
      morePages = roles.length === pageLimit;
    }

    if (!allRoles.length) {
      return { data: [], fromCache: false };
    }

    // Step 2️⃣: Extract unique person_ids
    const personIds = [...new Set(allRoles.map((r) => r.person_id))];
    const BATCH_SIZE = 50;
    const allPersonDetails = [];

    for (let i = 0; i < personIds.length; i += BATCH_SIZE) {
      const batchIds = personIds.slice(i, i + BATCH_SIZE).join(",");
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const bioParams = {
          id__in: batchIds,
          api_key: process.env.QUORUM_API_KEY,
          username: process.env.QUORUM_USERNAME,
          limit: BATCH_SIZE,
        };

        const bioTask = () =>
          apiClient.get("https://www.quorum.us/api/newperson/", {
            params: bioParams,
          });

        const bioResponse = await this.quorumController._requestQueue.add(
          bioTask
        );
        const personBios = bioResponse.data?.objects || [];

        // 🔍 Log API response for verification
        personBios.forEach((person) => {
          const nameStartsWithFormer = (person.name || "").startsWith("Former");
          const titleMatches =
            person.title ===
            (type === "senator" ? "US Senator" : "US Representative");
        });

        allPersonDetails.push(...personBios);
      } catch (err) {
        console.warn(`   ⚠️ Batch ${batchNum} failed:`, err.message);
      }
    }
    // Step 4️⃣: Merge roles with bio info and FILTER by name/title
    const expectedTitle =
      type === "senator" ? "US Senator" : "US Representative";

    const formerMembersRaw = allRoles
      .map((role) => {
        const person =
          allPersonDetails.find((p) => p.id === role.person_id) || {};
        return {
          ...role,
          ...person,
          current: false, 
        };
      })
      .filter((member) => {
        const apiName = member.name || "";
        const nameStartsWithFormer = apiName.startsWith("Former");
        const titleIsCorrect = member.title === expectedTitle;

        if (!nameStartsWithFormer || !titleIsCorrect) {
          const reason = !nameStartsWithFormer
            ? `Name doesn't start with 'Former'`
            : `Title is '${member.title}' not '${expectedTitle}'`;
          return false;
        }
        return true;
      });

    //  Step 5️⃣: Deduplicate by person_id
    const seenPersonIds = new Set();
    const formerMembers = [];
    const duplicates = [];

    formerMembersRaw.forEach((member) => {
      const personId = member.person_id;
      if (seenPersonIds.has(personId)) {
        duplicates.push({
          personId,
          name: member.name,
          occurrences: seenPersonIds.has(personId),
        });
       
        return;
      }
      seenPersonIds.add(personId);
      formerMembers.push(member);
    });

    // Cache the result
    this._formerMembersCache[type] = {
      data: formerMembers,
      timestamp: now,
    };

    return { data: formerMembers, fromCache: false };
  }

  async saveFormerMembersByType(type, req, res) {
    try {
      if (!["senator", "representative"].includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }

      const circuitBreaker = this.quorumController._circuitBreakers.quorum;
      if (!circuitBreaker.canRequest()) {
        return res.status(503).json({
          error: "Service unavailable",
          message: "Quorum API is currently unavailable. Try again later.",
        });
      }

      // Fetch former members (with caching)
      const { data: formerMembers, fromCache } = await this.fetchFormerMembers(
        type
      );

      if (!formerMembers.length) {
        return res.status(400).json({
          message: `No former ${type}s found.`,
          count: 0,
        });
      }

      const transformedMembers = await this.quorumController.filterData(
        type,
        formerMembers
      );

      if (transformedMembers.length > 0) {
        transformedMembers.slice(0, 3).forEach((member, index) => {
          const idField = type === "senator" ? "senatorId" : "repId";
          const stateOrDistrict =
            type === "senator" ? member.state : member.district;
        });
      }

      // Return the transformed data
      return res.json({
        message: `${transformedMembers.length} unique former ${type}s fetched and transformed (current: false, no duplicates)`,
        stats: {
          beforeTransformation: formerMembers.length,
          afterTransformation: transformedMembers.length,
          fromCache: fromCache,
        },
        data: transformedMembers,
      });
    } catch (error) {
      console.error(`saveFormerMembersByType(${type}) error:`, error.message);
      return res.status(500).json({
        error: `Failed to fetch former ${type}s`,
        message: error.message,
      });
    }
  }

  async saveFomerMembersToDatabase(req, res) {
    try {
      const { type } = req.body;

      if (!["senator", "representative"].includes(type)) {
        return res.status(400).json({
          error: "Invalid type. Use 'senator' or 'representative'",
        });
      }

      const modelConfig = {
        senator: { model: Senator, idField: "senatorId" },
        representative: { model: Representative, idField: "repId" },
      }[type];

      if (!modelConfig) {
        return res.status(400).json({ error: "Invalid data type" });
      }

      const circuitBreaker = this.quorumController._circuitBreakers.quorum;
      if (!circuitBreaker.canRequest()) {
        return res.status(503).json({
          error: "Service unavailable",
          message: "Quorum API is currently unavailable. Try again later.",
        });
      }

      // Fetch former members (with caching)
      const { data: formerMembers, fromCache } = await this.fetchFormerMembers(
        type
      );

      if (!formerMembers.length) {
        return res.status(400).json({
          error: `No valid former ${type}s to save`,
          count: 0,
        });
      }
      const transformed = await this.quorumController.filterData(
        type,
        formerMembers,
        {}
      );

      if (!transformed.length) {
        return res.status(400).json({
          error: `Transformed data is empty - filterData returned 0 records`,
          count: 0,
          debug: {
            beforeTransform: formerMembers.length,
            afterTransform: transformed.length,
          },
        });
      }

      // Step 7️⃣: Save to database in batches
      const { model, idField } = modelConfig;
      const DB_BATCH_SIZE = cacheConfig.BATCH_SIZES.DATABASE_OPERATIONS || 50;
      let savedCount = 0;

      for (let i = 0; i < transformed.length; i += DB_BATCH_SIZE) {
        const batch = transformed.slice(i, i + DB_BATCH_SIZE);
        const batchNum = Math.floor(i / DB_BATCH_SIZE) + 1;

        try {
          // This prevents duplicates and preserves all manually edited data
          const result = await model.bulkWrite(
            batch.map((item) => ({
              insertOne: {
                document: item,
              },
            })),
            { ordered: false } // Continue inserting even if some fail (duplicates by unique ID)
          );

          savedCount += result.insertedCount;
        } catch (batchErr) {
          // Handle bulk write errors - duplicate key errors are expected and ok
          if (batchErr.result?.insertedCount) {
            savedCount += batchErr.result.insertedCount;
          }
          // Log other errors but continue
          if (batchErr.code !== 11000) {
            console.error(`   ❌ Batch ${batchNum} failed:`, batchErr.message);
          }
        }
      }

      return res.json({
        message: `Successfully saved ${savedCount} former ${type}s to database`,
        stats: {
          transformed: transformed.length,
          savedToDb: savedCount,
          totalProcessed: savedCount,
          fromCache: fromCache,
          cacheAge: fromCache ? "recent" : "fresh",
        },
      });
    } catch (error) {
      console.error(
        `saveFomerMembersToDatabase(${req.body?.type}) error:`,
        error.message
      );
      return res.status(500).json({
        error: `Failed to save former members to database`,
        message: error.message,
      });
    }
  }

  // Clear cache when needed
  clearCache(type = null) {
    if (type) {
      this._formerMembersCache[type] = { data: null, timestamp: 0 };
    } else {
      this._formerMembersCache = {
        senator: { data: null, timestamp: 0 },
        representative: { data: null, timestamp: 0 },
      };
    }
  }
}

module.exports = FormerMembersController;
