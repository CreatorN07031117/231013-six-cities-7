import {inject, injectable} from 'inversify';
import {Request, Response} from 'express';
import {StatusCodes} from 'http-status-codes';

import {
  BaseController,
  HttpMethod,
  HttpError,
  ValidateObjectIdMiddleware,
  ValidateDtoMiddleware,
  DocumentExistsMiddleware,
  PrivateRouteMiddleware,
  CheckUserAccessMiddleware,
  UploadFileMiddleware,
} from '../../libs/rest/index.js';
import {Logger} from '../../libs/logger/index.js';
import {City, Component} from '../../enum/index.js';
import {fillDTO} from '../../helpers/index.js';
import {CommentService} from '../comment/index.js';
import {UserService} from '../user/index.js';
import {OfferService} from './offer-service.interface.js';
import {OfferRDO} from './rdo/offer.rdo.js';
import {DetailsOfferRDO} from './rdo/details-offer.rdo.js';
import {CreateOfferDTO} from './dto/create-offer.dto.js';
import {UpdateOfferDTO} from './dto/update-offer.dto.js';
import {DEFAULT_OFFERS_COUNT} from '../../constants/constants.js';
import {Config, RestSchema} from '../../libs/config/index.js';
import {UploadPreviewImgRDO} from './rdo/upload-preview-img.rdo.js';


@injectable()
export class OfferController extends BaseController {
  constructor(
    @inject(Component.Logger) protected readonly logger: Logger,
    @inject(Component.OfferService) private readonly offerService: OfferService,
    @inject(Component.CommentService) private readonly commentServise: CommentService,
    @inject(Component.UserService) private readonly userService: UserService,
    @inject(Component.Config) private readonly configService: Config<RestSchema>,
  ) {
    super(logger);

    this.logger.info('Register routes for OfferController...');

    this.addRoute({path: '/', method: HttpMethod.Get, handler: this.index });
    this.addRoute({
      path: '/',
      method: HttpMethod.Post,
      handler: this.create,
      middlewares: [
        new PrivateRouteMiddleware(),
        new ValidateDtoMiddleware(CreateOfferDTO)
      ]
    });
    this.addRoute({
      path: '/favorites',
      method: HttpMethod.Get,
      handler: this.favorites,
      middlewares: [
        new PrivateRouteMiddleware(),
      ]
    });
    this.addRoute({
      path: '/:offerId/update',
      method: HttpMethod.Patch,
      handler: this.update,
      middlewares: [
        new PrivateRouteMiddleware(),
        new ValidateDtoMiddleware(UpdateOfferDTO),
        new CheckUserAccessMiddleware(this.offerService, 'offerId')
      ]
    });
    this.addRoute({
      path: '/:offerId/details',
      method: HttpMethod.Get,
      handler: this.details,
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        new DocumentExistsMiddleware(this.offerService, 'Offer', 'offerId')
      ]
    });
    this.addRoute({
      path: '/:offerId/favorites',
      method: HttpMethod.Patch,
      handler: this.switchFavorite,
      middlewares: [
        new PrivateRouteMiddleware(),
        new ValidateObjectIdMiddleware('offerId'),
      ]
    });
    this.addRoute({
      path: '/:offerId/delete',
      method: HttpMethod.Delete,
      handler: this.delete,
      middlewares: [
        new PrivateRouteMiddleware(),
        new CheckUserAccessMiddleware(this.offerService, 'offerId')
      ]
    });
    this.addRoute({ path: '/:city/premium', method: HttpMethod.Get, handler: this.premium });
    this.addRoute({
      path:'/:offerId/uploadImage',
      method: HttpMethod.Post,
      handler: this.uploadImage,
      middlewares: [
        new PrivateRouteMiddleware(),
        new CheckUserAccessMiddleware(this.offerService, 'offerId'),
        new UploadFileMiddleware(this.configService.get('UPLOAD_DIRECTORY'), 'image'),
      ]
    });
  }

  public async index(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : DEFAULT_OFFERS_COUNT;
    const offers = await this.offerService.find(limit);
    const responseData = fillDTO(OfferRDO, offers);
    this.ok(res, responseData);
  }

  public async create(
    { body, tokenPayload }: Request<Record<string, unknown>, Record<string, unknown>, CreateOfferDTO>,
    res: Response
  ): Promise<void> {
    const newOffer = await this.offerService.create({
      ...body,
      userId: tokenPayload.id,
    });
    this.created(res, fillDTO(DetailsOfferRDO, newOffer));
  }

  public async premium(req: Request, res: Response): Promise<void> {
    const city = req.params.city;

    if (!Object.values(City).includes(city as City)) {
      throw new HttpError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        `${city} doesn't exists in database.`,
        'CityController'
      );
    }
    const offers = await this.offerService.getPremiumOffersByCity(city as City);
    const responseData = fillDTO(OfferRDO, offers);
    this.ok(res, responseData);
  }

  public async update({ params, body }: Request<Record<string, unknown>, Record<string, unknown>, UpdateOfferDTO>,
    res: Response): Promise<void> {
    console.log(body);
    const updateOffer = await this.offerService.updateById(params.offerId as string, body);

    const responseData = fillDTO(DetailsOfferRDO, updateOffer);
    this.ok(res, responseData);
  }

  public async details({ params, tokenPayload }: Request<Record<string, unknown>, Record<string, unknown>>,
    res: Response): Promise<void> {
    const detailsOffer = await this.offerService.findById(params.offerId as string);
    let responseData: DetailsOfferRDO & {isFavorite?: boolean} = fillDTO(DetailsOfferRDO, detailsOffer);

    if(tokenPayload){
      const favoriteOffersId = await this.userService
        .findByEmail(tokenPayload.email)
        .then((data) => data?.favoriteOffersId);

      responseData = {...responseData, isFavorite: favoriteOffersId?.includes(params.offerId as string)};
    }

    this.ok(res, responseData);
  }

  public async delete({ params }: Request<Record<string, unknown>, Record<string, unknown>>,
    res: Response): Promise<void> {
    const deleteOffer = await this.offerService.deleteById(params.offerId as string);
    await this.commentServise.deleteByOfferId(params.offerId as string);

    const responseData = fillDTO(DetailsOfferRDO, deleteOffer);
    this.ok(res, responseData);
  }

  public async favorites({ tokenPayload }: Request<Record<string, unknown>, Record<string, unknown>>,
    res: Response): Promise<void> {
    const favoriteOffers = await this.userService
      .findByEmail(tokenPayload.email)
      .then((data) => data?.favoriteOffersId);

    const responseData = [];
    if(favoriteOffers) {
      let counter = 0;
      while(counter < favoriteOffers.length) {
        const offer = await this.offerService.findById(favoriteOffers[counter]);
        const fillingOffer = fillDTO(OfferRDO, offer);
        responseData .push({...fillingOffer, isFavorite: true});
        counter = counter + 1;
      }
    }

    this.ok(res, responseData);
  }

  public async switchFavorite({params, tokenPayload }: Request<Record<string, unknown>, Record<string, unknown>>,
    res: Response): Promise<void> {
    const favoriteOffersId = await this.userService
      .findByEmail(tokenPayload.email)
      .then((data) => data?.favoriteOffersId);

    let updateFavoriteOffersId: string[];

    const offer = await this.offerService.findById(params.offerId as string);
    let responseData;
    if(favoriteOffersId?.includes(params.offerId as string)) {
      updateFavoriteOffersId = favoriteOffersId.filter((id) => id !== params.offerId as string);
      responseData = { ...fillDTO(DetailsOfferRDO, offer), isFavorite: false};
    } else {
      updateFavoriteOffersId = favoriteOffersId ? [...favoriteOffersId, params.offerId as string] : [params.offerId as string];
      responseData = { ...fillDTO(DetailsOfferRDO, offer), isFavorite: true};
    }

    await this.userService
      .updateById(tokenPayload.id, {favoriteOffersId: updateFavoriteOffersId});

    this.ok(res, responseData);
  }

  public async uploadImage({params, file}: Request<Record<string, unknown>>, res: Response) {
    const {offerId} = params;
    const uploadPreviewImgDTO = {previewImg: file?.filename};
    await this.offerService.updateById(offerId as string, uploadPreviewImgDTO);
    this.created(res, fillDTO(UploadPreviewImgRDO, uploadPreviewImgDTO));
  }
}
