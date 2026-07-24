const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

dns.resolveSrv("_mongodb._tcp.cluster0.jq4axfo.mongodb.net", (err, addresses) => {
  if (err) {
    console.error("SRV Error:", err);
  } else {
    console.log("SRV Addresses:", JSON.stringify(addresses, null, 2));
  }
});
