const express = require("express");
const axios = require("axios");
const cors = require("cors");
const redis = require("redis");

const redisClient = redis.createClient();

const DEFAULT_EXP = 90;

const app = express();
app.use(express.json());
app.use(express.raw());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

redisClient.on("error", (err) => console.log("Redis Client Error", err));

app.get("/photos", async (req, res) => {
  const albumId = req.query.albumId;
  const photos = await redisClient.get(`photos?albumId=${albumId}`);
  if (photos !== null) {
    return res.status(200).json({ msg: "Redis", photos: JSON.parse(photos) });
  } else {
    const { data } = await axios.get(
      "https://jsonplaceholder.typicode.com/photos",
      { params: { albumId } }
    );
    await redisClient.setEx(
      `photos?albumId=${albumId}`,
      DEFAULT_EXP,
      JSON.stringify(data)
    );
    return res.status(200).json({ msg: "Axios", photos: data });
  }
});

app.get("/photos/:id", async (req, res) => {
  const id = req.params.id;
  const photo = await getOrSetCache(`photos?albumId=${id}`, async () => {
    const { data } = await axios.get(
      `https://jsonplaceholder.typicode.com/photos/${req.params.id}`
    );
    return data;
  });

  return res.status(200).json({ photo });
});

const startServer = async () => {
  try {
    await redisClient.connect();
    app.listen(4000, () => {
      console.log(`Server is listening on port: 4000...`);
    });
  } catch (error) {
    console.log(error);
  }
};

async function getOrSetCache(key, cb) {
  const data = await redisClient.get(key);
  if (data !== null) {
    return JSON.parse(data);
  } else {
    const freshData = await cb();
    await redisClient.setEx(key, DEFAULT_EXP, JSON.stringify(freshData));
    return freshData;
  }
}

startServer();
