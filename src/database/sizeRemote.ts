import * as request from "request";
import { Response } from "request";
import * as responseToError from "../responseToError";
import * as utils from "../utils";
import * as FirebaseError from "../error";
import * as logger from "../logger";
import * as api from "../api";

import { RTDBSizeResult, SizeResult } from "./sizeResult";

export interface SizeRemote {
  /**
   * Call the shallow get API with limitToFirst=numSubPath.
   * @param path the path to list
   * @param numSubPath the number of subPaths to fetch.
   * @return the list of sub pathes found.
   */
  sizeNode(path: string, timeout: number): Promise<SizeResult>;
}

export class RTDBSizeRemote implements SizeRemote {
  private instance: string;

  constructor(instance: string) {
    this.instance = instance;
  }

  sizeNode(path: string, timeout: number): Promise<SizeResult> {
    const url =
      utils.addSubdomain(api.realtimeOrigin, this.instance) +
      path +
      ".json?timeout=" +
      timeout +
      "ms";
    const reqOptions = {
      url,
    };
    return api.addRequestHeaders(reqOptions).then((reqOptionsWithToken) => {
      return new Promise((resolve, reject) => {
        let response: any;
        let errorResponse = "";
        let payload = "";
        let erroring = false;

        request
          .get(reqOptionsWithToken)
          .on("response", (res) => {
            response = res;
            if (response.statusCode >= 400) {
              erroring = true;
            }
          })
          .on("data", (chunk) => {
            if (erroring) {
              errorResponse += chunk;
            } else {
              payload += chunk;
            }
          })
          .on("end", () => {
            let data = {};
            if (erroring) {
              try {
                data = JSON.parse(errorResponse);
                resolve(new RTDBSizeResult(false, 0, responseToError(response, data)));
              } catch (e) {
                resolve(
                  new RTDBSizeResult(
                    false,
                    0,
                    new FirebaseError("Malformed JSON response", {
                      exit: 2,
                      original: e,
                    })
                  )
                );
              }
            } else {
              try {
                /*
                 * This parsing is strictly for validation.
                 */
                JSON.parse(payload);

                /*
                 * For simplicity, we consider size to be the raw byte length
                 * in the payload of the response. This is an estimate. It
                 * does not necessarily reflect the size of the JSON subtree
                 * as stored in the RTDB persistence layer, but is meaningful
                 * to applications that process the output of such requests.
                 */
                resolve(new RTDBSizeResult(true, Buffer.byteLength(payload)));
              } catch (e) {
                resolve(
                  new RTDBSizeResult(
                    false,
                    0,
                    new FirebaseError("Malformed JSON response", {
                      exit: 2,
                      original: e,
                    })
                  )
                );
              }
            }
          })
          .on("error", (err) => {
            resolve(
              new RTDBSizeResult(
                false,
                0,
                new FirebaseError("Malformed JSON response", {
                  exit: 2,
                  original: err,
                })
              )
            );
          });
      });
    });
  }
}
