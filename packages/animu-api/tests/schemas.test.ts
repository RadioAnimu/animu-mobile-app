import { describe, expect, it } from "vitest";
import {
  ListenersDTOSchema,
  MusicRequestResponseDTOSchema,
  ProgramDTOSchema,
  StreamListDTOSchema,
  StreamMetadataDTOSchema,
  TrackHistorySchema,
  UserDTOSchema,
} from "../src/schemas";
import {
  metadataPayload,
  metadataPayloadWithAlias,
  playedHistoryPayload,
  programPayloadMalformed,
  requestsHistoryPayload,
  searchResponsePayload,
  streamsPayload,
  userExchangePayload,
} from "./fixtures";

describe("StreamMetadataDTOSchema", () => {
  it("coerces numeric fields sent as strings", () => {
    const dto = StreamMetadataDTOSchema.parse(metadataPayload);
    expect(dto.track!.duration).toBe(264000);
    expect(dto.track!.timestart).toBe(1788408452000);
    expect(dto.track!.playlist?.track_id).toBe(16217);
    expect(dto.listeners).toBe(21);
  });

  it("accepts the currentListeners alias", () => {
    const dto = StreamMetadataDTOSchema.parse(metadataPayloadWithAlias);
    expect(dto.currentListeners).toBe(7);
  });

  it("accepts payloads without artworks or playlist", () => {
    const dto = StreamMetadataDTOSchema.parse(metadataPayloadWithAlias);
    expect(dto.track!.artworks).toBeUndefined();
    expect(dto.track!.playlist).toBeUndefined();
  });
});

describe("ListenersDTOSchema", () => {
  it("accepts every known alias", () => {
    expect(ListenersDTOSchema.parse({ listeners: "5" }).listeners).toBe(5);
    expect(ListenersDTOSchema.parse({ active_listeners: 6 }).active_listeners).toBe(6);
    expect(ListenersDTOSchema.parse({ total: "9" }).total).toBe(9);
  });

  it("accepts an empty object (all aliases optional)", () => {
    expect(ListenersDTOSchema.parse({})).toEqual({});
  });
});

describe("ProgramDTOSchema", () => {
  it("degrades malformed fields to empty strings instead of throwing", () => {
    const dto = ProgramDTOSchema.parse(programPayloadMalformed);
    expect(dto).toEqual({
      locutor: "",
      programa: "",
      pedidos_ao_vivo: "",
      imagem: "",
      infoPrograma: "",
      temaPrograma: "",
    });
  });
});

describe("TrackHistorySchema", () => {
  it("parses positional played rows", () => {
    const dto = TrackHistorySchema.parse(playedHistoryPayload);
    expect(dto).toHaveLength(3);
    expect(dto[0]?.[0]).toContain("Renai Circulation");
  });

  it("parses positional requests rows with loose trailing entries", () => {
    const dto = TrackHistorySchema.parse(requestsHistoryPayload);
    expect(dto[0]?.[2]).toBe("9126");
    expect(dto[0]?.[3]).toContain("req.jpg");
  });

  it("rejects rows that are not string tuples", () => {
    expect(TrackHistorySchema.safeParse([["ok", "ok"], "bad"]).success).toBe(false);
    expect(TrackHistorySchema.safeParse("not an array").success).toBe(false);
  });
});

describe("MusicRequestResponseDTOSchema", () => {
  it("coerces pagination numbers and ids", () => {
    const dto = MusicRequestResponseDTOSchema.parse(searchResponsePayload);
    expect(dto.meta.total_count).toBe(34);
    expect(dto.meta.limit).toBe(25);
    expect(dto.meta.next).toContain("offset=25");
    expect(dto.objects[0]?.id).toBe(9126);
    expect(dto.objects[1]?.id).toBe(9200);
  });

  it("keeps timestrike as an optional string", () => {
    const dto = MusicRequestResponseDTOSchema.parse(searchResponsePayload);
    expect(dto.objects[0]?.timestrike).toBe("");
    expect(dto.objects[1]?.timestrike).toBeUndefined();
  });
});

describe("StreamListDTOSchema", () => {
  it("coerces bitrate strings", () => {
    const dto = StreamListDTOSchema.parse(streamsPayload);
    expect(dto[0]?.bitrate).toBe(320);
    expect(dto[1]?.bitrate).toBe(192);
  });

  it("rejects an empty list", () => {
    expect(StreamListDTOSchema.safeParse([]).success).toBe(false);
  });
});

describe("UserDTOSchema", () => {
  it("parses an exchange payload with coerced mfa flag", () => {
    const dto = UserDTOSchema.parse({
      ...userExchangePayload.user,
      PHPSESSID: userExchangePayload.PHPSESSID,
    });
    expect(dto.mfa).toBe(true);
    expect(dto.PHPSESSID).toBe("sess-abc123");
    expect(dto.avatar_decoration_data).toEqual({ asset: "x" });
  });

  it("rejects missing required fields", () => {
    expect(UserDTOSchema.safeParse({ id: "1" }).success).toBe(false);
  });
});
