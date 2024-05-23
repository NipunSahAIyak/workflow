import {
  Body,
  CACHE_MANAGER,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { AppService } from './app.service';
import { v4 as uuidv4 } from 'uuid';

import { Cache } from 'cache-manager';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Minio = require('minio');

import { Client, ItemBucketMetadata } from 'minio';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const parser = require('xml2json');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('request');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const xml2js = require('xml2js');

type PrefillDto = {
  form: string;
  onFormSuccessData: any;
  prefillSpec: any;
};

@Controller()
export class AppController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly appService: AppService,
    private configService: ConfigService,
  ) { }

  MINIO_ENDPOINT = this.configService.get('MINIO_ENDPOINT');
  MINIO_URL = this.configService.get('MINIO_URL');
  FORM_MANAGER_URL = this.configService.get('FORM_MANAGER_URL');

  getLoginToken = () => {
    try {
      const postData = {
        loginId: this.configService.get('MINIO_LOGIN_ID'),
        password: this.configService.get('MINIO_PASSWORD'),
        applicationId: this.configService.get('MINIO_APPLICATION_ID'),
      };

      const header = {
        'content-type': 'application/json',
        Authorization: this.configService.get('MINIOT_HEADER_AUTH_TOKEN'),
      };

      const options = {
        method: 'POST',
        url: this.configService.get('MINIO_LOGIN_URL'),
        headers: header,
        json: postData,
      };

      console.log(options);

      return new Promise((resolve, reject) => {
        request(options, function (error, response, body) {
          if (error || !body) {
            return reject(error);
          }
          resolve(body.token);
        });
      });
    } catch (err) {
      console.log('Error', err);
      throw err;
    }
  };

  getSessionToken = async (logToken) => {
    const MINIO = {
      BUCKET_ID: this.configService.get('MINIO_BUCKET_ID'),
      HOST: this.configService.get('MINIO_HOST'),
    };

    try {
      const options = {
        method: 'POST',
        url: `https://${MINIO.HOST}/minio/${MINIO.BUCKET_ID}/?Action=AssumeRoleWithWebIdentity&DurationSeconds=36000&WebIdentityToken=${logToken}&Version=2011-06-15`,
      };

      return new Promise((resolve, reject) => {
        request(options, async function (error, response, body) {
          if (error || !body) {
            return reject(error);
          }
          const parser = new xml2js.Parser();
          const doc = await parser.parseStringPromise(body);

          if (
            doc &&
            doc.AssumeRoleWithWebIdentityResponse &&
            doc.AssumeRoleWithWebIdentityResponse
              .AssumeRoleWithWebIdentityResult &&
            doc.AssumeRoleWithWebIdentityResponse
              .AssumeRoleWithWebIdentityResult.length &&
            doc.AssumeRoleWithWebIdentityResponse
              .AssumeRoleWithWebIdentityResult[0].Credentials &&
            doc.AssumeRoleWithWebIdentityResponse
              .AssumeRoleWithWebIdentityResult[0].Credentials.length
          ) {
            const creds =
              doc.AssumeRoleWithWebIdentityResponse
                .AssumeRoleWithWebIdentityResult[0].Credentials[0];

            return resolve({
              accessKey: creds.AccessKeyId[0],
              secretKey: creds.SecretAccessKey[0],
              sessionToken: creds.SessionToken[0],
            });
          }
          reject('Body error');
        });
      });
    } catch (err) {
      console.log(err);
      throw err;
    }
  };

  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }

  @Post('prefill')
  getPrefill(@Body() prefillDto: PrefillDto): string {
    return this.appService.prefillForm(
      prefillDto.form,
      prefillDto.onFormSuccessData,
      prefillDto.prefillSpec,
    );
  }

  @Get('prefill')
  prefill(
    @Query('form') form,
    @Query('onFormSuccessData') onFormSuccessData,
    @Query('prefillSpec') prefillSpec,
  ): string {
    try {
      console.log('onFormSuccessData', onFormSuccessData);
      console.log('prefillSpec', prefillSpec);
      if (onFormSuccessData !== 'undefined') {
        return this.appService.prefillForm(
          form,
          JSON.parse(onFormSuccessData),
          JSON.parse(prefillSpec),
        );
      } else {
        return this.appService.getForm(form);
      }
    } catch (e) {
      return this.appService.getForm(form);
    }
  }

  @Post('prefillXML')
  async prefillXML(
    @Query('form') form,
    @Query('onFormSuccessData') onFormSuccessData,
    @Body('prefillXML') prefillXML,
    @Body('imageUrls') files,
  ): Promise<string> {
    try {
      if (onFormSuccessData) {
        const prefilledForm = this.appService.prefillFormXML(
          form,
          onFormSuccessData,
          prefillXML,
          files,
        );
        const instanceId = uuidv4();
        await this.cacheManager.set(instanceId, prefilledForm, 86400 * 10);
        return `${this.FORM_MANAGER_URL}/form/instance/${instanceId}`;
      } else {
        return 'OK';
      }
    } catch (e) {
      console.error(e);
      return 'OK2';
    }
  }

  @Post('submissionXML')
  async submissionXML(
    @Query('form') form,
    @Body('prefillXML') prefillXML,
    @Body('imageUrls') files,
  ): Promise<string> {
    try {
      const submissionFormXML = this.appService.submissionFormXML(
        form,
        prefillXML,
        files,
      );
      return submissionFormXML;
    } catch (e) {
      console.error(e);
      return 'OK2';
    }
  }

  @Get('form/:id')
  getForm(@Param('id') id): string {
    return this.appService.getForm(id);
  }

  @Get('form/instance/:instanceId')
  async getFormWithInstanceID(
    @Param('instanceId') instanceId,
  ): Promise<string> {
    const xml = await this.cacheManager.get(instanceId);
    return xml;
  }

  @Post('parse')
  parseXML(@Body() xml: any): any {
    // console.log({ xml })
    // console.log(parser.toJson(xml));
    return parser.toJson(xml.xml);
  }

  @Get('osceForm/:type/:year/:speciality?')
  getOsceForm(
    @Param('type') type,
    @Param('year') year,
    @Param('speciality') speciality,
  ): any {
    return this.appService.getOsceForms(type, year, speciality);
  }

  @Get('osceFormTeachers/:type/:year/:speciality?')
  getOsceFormTeachers(
    @Param('type') type,
    @Param('year') year,
    @Param('speciality') speciality,
  ): any {
    return this.appService.getOsceForms(type, year, speciality, 2);
  }

  @Post('form/uploadFile')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log(file);
    const extension = file.originalname.split('.').pop();
    const fileName = uuidv4() + `.${extension}`;
    // const tokenRes = await this.getLoginToken();
    // const sessionRes: any = await this.getSessionToken(tokenRes);

    // console.log('sessionRes', sessionRes);

    const minioClient: Client = new Minio.Client({
      endPoint: this.MINIO_ENDPOINT,
      port: parseInt(this.configService.get('MINIO_PORT')),
      useSSL: this.configService.get('MINIO_USE_SSL') === true,
      accessKey: this.configService.get('MINIO_USERNAME'),
      secretKey: this.configService.get('MINIO_PASSWORD')
    });

    const metaData: ItemBucketMetadata = {
      'Content-Type': file.mimetype,
    };

    minioClient.putObject(
      this.configService.get('MINIO_BUCKETNAME'),
      fileName,
      file.buffer,
      file.size,
      metaData,
      //@ts-ignore
      function (err, res) {
        if (err) {
          console.log(err)
          throw new HttpException(
            'Error uploading file',
            HttpStatus.BAD_REQUEST,
          );
        }
      },
    );

    const fileURL = `${this.MINIO_URL}/${this.configService.get('MINIO_BUCKETNAME')}/${fileName}`;

    console.log('Uploaded File:', fileURL);

    return { fileURL };
  }
}
